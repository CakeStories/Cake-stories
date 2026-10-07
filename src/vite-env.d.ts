/// <reference types="vite/client" />

declare module "*.asset.json" {
  const value: { url: string; [key: string]: unknown };
  export default value;
}
