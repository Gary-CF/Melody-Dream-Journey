import ts from "typescript";
import { readdirSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";

const slash = (s) => s.replaceAll("\\", "/");
const codeExtensions = [".ts", ".tsx", ".js", ".mjs", ".cjs"];
export function readSources(root, directories = ["src", "server"]) {
  const files = {};
  function visit(directory) {
    for (const entry of readdirSync(resolve(root, directory), {
      withFileTypes: true,
    })) {
      const name = slash(`${directory}/${entry.name}`);
      if (entry.isDirectory()) visit(name);
      else if (codeExtensions.includes(extname(name)))
        files[name] = readFileSync(resolve(root, name), "utf8");
    }
  }
  directories.forEach(visit);
  return files;
}

// Inspect explicit source-level dependencies. A value import used only as a type
// must be marked `type`; this keeps the boundary independent of bundler elision.
export function inspectArchitecture(files, policy) {
  const nodes = Object.keys(files).sort();
  const edges = [],
    violations = [];
  const options = { noLib: true, noResolve: true, allowJs: true };
  const host = ts.createCompilerHost(options);
  host.getSourceFile = (file, version) => {
    const key = slash(file);
    return key in files
      ? ts.createSourceFile(key, files[key], version, true)
      : undefined;
  };
  const program = ts.createProgram(nodes, options, host);
  const checker = program.getTypeChecker();
  const addViolation = (rule, file, detail, line) =>
    violations.push({ rule, file, detail, ...(line ? { line } : {}) });
  const groupFor = (file) =>
    policy.modules[file] ??
    policy.prefixes?.find(([prefix]) => file.startsWith(prefix))?.[1];
  for (const file of nodes) {
    const group = groupFor(file);
    if (!group)
      addViolation(
        "unclassified-module",
        file,
        "Register a responsibility before adding a module",
      );
    const ast = program.getSourceFile(file);
    const line = (n) =>
      ast.getLineAndCharacterOfPosition(n.getStart(ast)).line + 1;
    function dependency(specifier, kind, node) {
      let target = specifier;
      const local = specifier.startsWith(".");
      if (local) {
        const stem = slash(
          relative(
            process.cwd(),
            resolve(process.cwd(), dirname(file), specifier),
          ),
        );
        const alternatives = [
          stem,
          ...codeExtensions.map((ext) => stem + ext),
          ...codeExtensions.map((ext) => stem + "/index" + ext),
        ];
        // TypeScript may import a .js path that is implemented in a .ts source.
        if (/\.m?js$/.test(stem))
          alternatives.push(stem.replace(/\.m?js$/, ".ts"));
        target = alternatives.find((candidate) => candidate in files) ?? stem;
        if (
          !(target in files) &&
          !/\.(css|svg|png|jpg|webp|json)$/.test(target)
        )
          addViolation("unresolved-local-import", file, specifier, line(node));
      }
      edges.push({
        from: file,
        to: target,
        kind,
        line: line(node),
        external: !local,
      });
      if (group === "domain" && (!local || groupFor(target) !== "domain"))
        addViolation(
          "domain-dependency",
          file,
          `${kind} dependency on ${target}`,
          line(node),
        );
      const allowed = policy.allowedDependencies?.[group];
      if (
        group !== "domain" &&
        local &&
        groupFor(target) &&
        allowed &&
        !allowed.includes(groupFor(target))
      )
        addViolation(
          "layer-dependency",
          file,
          `${group} → ${groupFor(target)} (${target})`,
          line(node),
        );
    }
    function visit(node) {
      if (ts.isImportDeclaration(node)) {
        const clause = node.importClause;
        const typeOnly =
          clause?.isTypeOnly ||
          (!clause?.name &&
            clause?.namedBindings &&
            ts.isNamedImports(clause.namedBindings) &&
            clause.namedBindings.elements.length > 0 &&
            clause.namedBindings.elements.every((e) => e.isTypeOnly));
        dependency(
          node.moduleSpecifier.text,
          typeOnly ? "type" : "runtime",
          node,
        );
      } else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
        const typeOnly =
          node.isTypeOnly ||
          (node.exportClause &&
            ts.isNamedExports(node.exportClause) &&
            node.exportClause.elements.length > 0 &&
            node.exportClause.elements.every((e) => e.isTypeOnly));
        dependency(
          node.moduleSpecifier.text,
          typeOnly ? "type" : "runtime",
          node,
        );
      } else if (
        ts.isImportTypeNode(node) &&
        ts.isLiteralTypeNode(node.argument) &&
        ts.isStringLiteral(node.argument.literal)
      ) {
        dependency(node.argument.literal.text, "type", node);
      } else if (
        ts.isImportEqualsDeclaration(node) &&
        ts.isExternalModuleReference(node.moduleReference) &&
        node.moduleReference.expression
      ) {
        dependency(
          node.moduleReference.expression.text,
          node.isTypeOnly ? "type" : "runtime",
          node,
        );
      } else if (
        ts.isCallExpression(node) &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(node.expression) &&
            node.expression.text === "require"))
      ) {
        const value = node.arguments[0];
        if (
          value &&
          (ts.isStringLiteral(value) ||
            ts.isNoSubstitutionTemplateLiteral(value))
        )
          dependency(value.text, "runtime", node);
        else
          addViolation(
            "opaque-dependency",
            file,
            "Computed module loads need an explicit adapter",
            line(node),
          );
      } else if (
        ts.isNewExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === "URL" &&
        node.arguments?.length === 2 &&
        node.arguments[1].getText(ast) === "import.meta.url"
      ) {
        const value = node.arguments[0];
        if (
          ts.isStringLiteral(value) &&
          codeExtensions.includes(extname(value.text))
        )
          dependency(value.text, "runtime", node);
      }
      const forbidden =
        group === "domain"
          ? policy.forbiddenDomainGlobals
          : policy.forbiddenGlobalsByGroup?.[group];
      if (ts.isIdentifier(node) && (forbidden ?? []).includes(node.text)) {
        // Property names/keys are data; references and shorthand properties are not.
        const parent = node.parent;
        const propertyName =
          (ts.isPropertyAccessExpression(parent) && parent.name === node) ||
          ((ts.isPropertyAssignment(parent) ||
            ts.isPropertySignature(parent) ||
            ts.isMethodDeclaration(parent)) &&
            parent.name === node);
        const symbol = checker.getSymbolAtLocation(node);
        const localBinding = symbol?.declarations?.some((d) => {
          if (d.getSourceFile() !== ast || ast.isDeclarationFile) return false;
          // `declare const window` supplies types, not a local runtime value.
          // It must not make a platform global appear to be harmless shadowing.
          let ancestor = d;
          while (ancestor && ancestor !== ast) {
            if (
              ts.canHaveModifiers(ancestor) &&
              ts
                .getModifiers(ancestor)
                ?.some((m) => m.kind === ts.SyntaxKind.DeclareKeyword)
            )
              return false;
            ancestor = ancestor.parent;
          }
          return true;
        });
        if (!propertyName && !localBinding)
          addViolation(
            group === "domain" ? "domain-platform-api" : "platform-boundary",
            file,
            node.text,
            line(node),
          );
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
  const adjacent = new Map(nodes.map((n) => [n, []]));
  for (const e of edges)
    if (e.kind === "runtime" && adjacent.has(e.to))
      adjacent.get(e.from).push(e.to);
  // Tarjan SCC: one actionable cycle group, rather than exponentially many paths.
  const index = new Map(),
    low = new Map(),
    stack = [],
    active = new Set(),
    cycles = [];
  let next = 0;
  function connect(v) {
    index.set(v, next);
    low.set(v, next++);
    stack.push(v);
    active.add(v);
    for (const w of adjacent.get(v)) {
      if (!index.has(w)) {
        connect(w);
        low.set(v, Math.min(low.get(v), low.get(w)));
      } else if (active.has(w)) low.set(v, Math.min(low.get(v), index.get(w)));
    }
    if (low.get(v) === index.get(v)) {
      const component = [];
      let w;
      do {
        w = stack.pop();
        active.delete(w);
        component.push(w);
      } while (w !== v);
      if (component.length > 1 || adjacent.get(v).includes(v))
        cycles.push(component.sort());
    }
  }
  nodes.forEach((n) => {
    if (!index.has(n)) connect(n);
  });
  cycles.sort((a, b) => a[0].localeCompare(b[0]));
  for (const cycle of cycles)
    addViolation("runtime-cycle", cycle[0], cycle.join(" ↔ "));
  return {
    version: 1,
    nodes: nodes.map((file) => ({
      file,
      group: groupFor(file) ?? "unclassified",
      bytes: Buffer.byteLength(files[file]),
    })),
    edges,
    runtimeCycles: cycles,
    violations,
  };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const root = process.cwd();
  const policy = JSON.parse(
    readFileSync(resolve(root, "architecture-policy.json"), "utf8"),
  );
  const report = inspectArchitecture(readSources(root), policy);
  const at = process.argv.indexOf("--report");
  if (at >= 0) {
    const output = process.argv[at + 1];
    if (!output) throw Error("--report needs an output path");
    mkdirSync(dirname(resolve(output)), { recursive: true });
    writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  }
  console.log(
    `${report.nodes.length} modules / ${report.edges.length} dependencies / ${report.runtimeCycles.length} runtime cycles / ${report.violations.length} violations`,
  );
  for (const v of report.violations)
    console.error(
      `${v.rule}: ${v.file}${v.line ? ":" + v.line : ""} — ${v.detail}`,
    );
  if (report.violations.length) process.exitCode = 1;
}
