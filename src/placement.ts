import * as T from "three";
import {
  validatePlacement,
  type SpatialIssue,
  type SpatialProxy,
  type Sweep,
  type Vec3,
  type Bounds3,
  validBounds,
} from "./domain/spatial";
import { collectProxies, releaseCandidate } from "./spatial-adapter";
import { collectSightSurfaces } from "./visibility-adapter";
import type { SightSurface } from "./domain/visibility";

export interface PlacementRecord {
  id: string;
  status: "accepted" | "relocated" | "rejected";
  attempts: number;
  displacement: Vec3;
  issues: SpatialIssue[];
}
export interface PlacementReplacement {
  id: string;
  revision: number;
  proxies: readonly SpatialProxy[];
  surfaces: readonly SightSurface[];
  issues: readonly SpatialIssue[];
}
export class SpatialBuildError extends Error {
  constructor(
    message: string,
    readonly records: readonly PlacementRecord[],
  ) {
    super(message);
    this.name = "SpatialBuildError";
  }
}
/** One placement boundary for built-ins, recipes and composed scenery. */
export class PlacementSession {
  readonly records: PlacementRecord[] = [];
  readonly proxies: SpatialProxy[] = [];
  readonly sightSurfaces: SightSurface[] = [];
  private revision = 0;
  private proposals = new WeakSet<PlacementReplacement>();
  private protectedSpaces: {
    owner: string;
    bounds: Bounds3;
    object?: T.Object3D;
    padding?: number;
  }[] = [];
  constructor(readonly reservations: readonly Sweep[]) {}
  protect(owner: string, bounds: Bounds3) {
    if (!owner || !validBounds(bounds)) throw Error("受保护空间边界无效");
    if (
      this.proxies.some(
        (p) =>
          p.instanceId !== owner &&
          p.role === "solid" &&
          p.bounds.min.every(
            (v, i) => v <= bounds.max[i] && p.bounds.max[i] >= bounds.min[i],
          ),
      )
    )
      throw Error("独立空间与已摆放组件重叠，请调整构图");
    this.protectedSpaces.push({ owner, bounds: structuredClone(bounds) });
    this.revision++;
  }
  /** Scenic clear space follows its owning assembly during bounded layout repair. */
  protectObject(owner: string, object: T.Object3D, padding = 0.5) {
    const bounds = new T.Box3().setFromObject(object).expandByScalar(padding);
    this.protect(owner, {
      min: bounds.min.toArray(),
      max: bounds.max.toArray(),
    });
    Object.assign(this.protectedSpaces.at(-1)!, { object, padding });
  }
  private spaceBounds(space: (typeof this.protectedSpaces)[number]): Bounds3 {
    if (!space.object) return space.bounds;
    const bounds = new T.Box3()
      .setFromObject(space.object)
      .expandByScalar(space.padding ?? 0);
    return { min: bounds.min.toArray(), max: bounds.max.toArray() };
  }
  private inspect(proxies: readonly SpatialProxy[]): SpatialIssue[] {
    const issues = validatePlacement(proxies, this.reservations);
    for (const space of this.protectedSpaces) {
      const bounds = this.spaceBounds(space);
      // During a trial, a moving clear volume must also avoid already accepted
      // scenery. Checking only the moving solid meshes would miss empty interiors.
      const candidates = proxies.some((p) => p.instanceId === space.owner)
        ? [
            ...proxies,
            ...this.proxies.filter((p) => p.instanceId !== space.owner),
          ]
        : proxies;
      const conflict = candidates.find(
        (p) =>
          p.instanceId !== space.owner &&
          p.role === "solid" &&
          p.bounds.min.every(
            (v, i) => v <= bounds.max[i] && p.bounds.max[i] >= bounds.min[i],
          ),
      );
      if (conflict)
        issues.push({
          code: "space-overlap",
          instanceId: conflict.instanceId,
          proxyId: conflict.id,
          reservationId: space.owner,
          timeRange: [0, 0],
          point: [...conflict.bounds.min],
          message: "组件侵入已声明的独立空间",
        });
    }
    return issues;
  }
  /** Capture a trial without altering the accepted spatial index. The caller
   * owns temporary object transforms; this boundary owns copied geometry only. */
  proposeReplacement(id: string, candidate: T.Object3D): PlacementReplacement {
    if (!this.records.some((r) => r.id === id && r.status !== "rejected"))
      throw Error(`Unknown placement: ${id}`);
    const proxies = collectProxies(candidate, id);
    const proposal = {
      id,
      revision: this.revision,
      proxies,
      surfaces: collectSightSurfaces(candidate, id),
      issues: this.inspect(proxies),
    };
    this.proposals.add(proposal);
    return proposal;
  }
  commitReplacement(proposal: PlacementReplacement) {
    if (
      !this.proposals.has(proposal) ||
      proposal.revision !== this.revision ||
      proposal.issues.length
    )
      throw Error("Invalid, unsafe or stale placement replacement");
    const keepProxies = this.proxies.filter(
      (p) => p.instanceId !== proposal.id,
    );
    const keepSurfaces = this.sightSurfaces.filter(
      (s) => s.instanceId !== proposal.id,
    );
    this.proxies.splice(
      0,
      this.proxies.length,
      ...keepProxies,
      ...proposal.proxies,
    );
    this.sightSurfaces.splice(
      0,
      this.sightSurfaces.length,
      ...keepSurfaces,
      ...proposal.surfaces,
    );
    this.proposals.delete(proposal);
    this.revision++;
  }
  place(
    id: string,
    candidate: T.Object3D,
    offsets: readonly Vec3[] = [[0, 0, 0]],
    motionPadding: Vec3 = [0, 0, 0],
    beforeMeasure?: () => void,
  ): PlacementRecord {
    const origin = candidate.position.clone();
    let issues: SpatialIssue[] = [];
    for (let i = 0; i < offsets.length; i++) {
      candidate.position.copy(origin).add(new T.Vector3(...offsets[i]));
      beforeMeasure?.();
      const proxies = collectProxies(candidate, id, motionPadding);
      const found = this.inspect(proxies);
      if (!found.length) {
        const record: PlacementRecord = {
          id,
          status: i === 0 ? "accepted" : "relocated",
          attempts: i + 1,
          displacement: [...offsets[i]],
          issues,
        };
        this.records.push(record);
        this.revision++;
        this.proxies.push(...proxies);
        this.sightSurfaces.push(
          ...collectSightSurfaces(candidate, id, motionPadding),
        );
        return record;
      }
      // Keep the first failure as a concrete explanation; no unbounded log of retries.
      if (!issues.length) issues = found;
    }
    candidate.position.copy(origin);
    beforeMeasure?.();
    const record: PlacementRecord = {
      id,
      status: "rejected",
      attempts: offsets.length,
      displacement: [0, 0, 0],
      issues,
    };
    this.records.push(record);
    releaseCandidate(candidate);
    return record;
  }
}
