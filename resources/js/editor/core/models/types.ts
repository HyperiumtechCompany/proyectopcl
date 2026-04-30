export type UUID = string;

// Base definition for any entity in the hierarchy
export interface BaseEntity {
    id: UUID;
    type: 'point' | 'wall' | 'space' | 'light' | 'door' | 'window';
    name?: string;
    metadata?: Record<string, any>;
}

// 1. Vertex (Point) - The fundamental unit of geometry
export interface PointNode extends BaseEntity {
    type: 'point';
    x: number;
    y: number;
    z?: number; // For multi-story or 3D specific elevation
}

// 2. Edge (Wall) - Connects two points
export interface WallNode extends BaseEntity {
    type: 'wall';
    startPointId: UUID;
    endPointId: UUID;
    thickness: number;
    height: number;
}

// 3. Face (Space) - Defines an enclosed area by traversing points
export interface SpaceNode extends BaseEntity {
    type: 'space';
    pointIds: UUID[]; // Ordered array of points that form the polygon
    color?: string;   // For visualization or functional tagging
}

// 4. Lights
export interface LightNode extends BaseEntity {
    type: 'light';
    lightType: 'point' | 'spot' | 'area';
    x: number;
    y: number;
    z: number;
    color: string;
    intensity: number; // In Lumens or Candela
}

// Union Type mapping everything for the Store
export type SceneNode = PointNode | WallNode | SpaceNode | LightNode;

// Represents the Project Hierarchy Structure
export interface Storey {
    id: UUID;
    name: string;
    elevation: number;
    height: number;
    nodes: Record<UUID, SceneNode>;
}

export interface Building {
    id: UUID;
    name: string;
    storeys: Record<UUID, Storey>;
    activeStoreyId?: UUID;
}

export interface ProjectData {
    id: UUID;
    name: string;
    buildings: Record<UUID, Building>;
    activeBuildingId?: UUID;
}
