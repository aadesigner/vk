declare module "react-simple-maps" {
  import type { ComponentType, CSSProperties, ReactNode } from "react";

  export interface GeoFeature {
    properties: Record<string, string>;
    rsmKey: string;
  }

  export const ComposableMap: ComponentType<{
    projection?: string;
    projectionConfig?: {
      scale?: number;
      center?: [number, number];
      rotate?: [number, number];
      parallels?: [number, number];
    };
    width?: number;
    height?: number;
    className?: string;
    preserveAspectRatio?: string;
    children?: ReactNode;
  }>;

  export const Geographies: ComponentType<{
    geography: string | object;
    children: (args: { geographies: GeoFeature[] }) => ReactNode;
  }>;

  export const Geography: ComponentType<{
    geography: GeoFeature;
    className?: string;
    style?: Record<string, CSSProperties>;
    [key: string]: unknown;
  }>;

  export const Marker: ComponentType<{
    coordinates: [number, number];
    children?: ReactNode;
  }>;

  export const Line: ComponentType<{
    from: [number, number];
    to: [number, number];
    stroke?: string;
    strokeWidth?: number;
    strokeLinecap?: string;
    className?: string;
    style?: CSSProperties;
  }>;
}
