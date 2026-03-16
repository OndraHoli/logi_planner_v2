export interface Pallet {
  id: string;
  name: string;
  width: number;  // v mm
  height: number; // v mm
  position: { x: number; y: number };
  color: string;
}

export interface Truck {
  width: number;  // v mm
  height: number; // v mm
}