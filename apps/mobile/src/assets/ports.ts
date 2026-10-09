/** Inject local native operations. No downloader, upload, user DB or model runtime. */
export interface LocalFilePort {
  stat(uri: string): Promise<{ exists: boolean; bytes?: number }>;
  sha256(uri: string): Promise<string>;
  readText(uri: string): Promise<string>;
  /** Copy into private storage, creating parents. Never overwrite the source. */
  copy(sourceUri: string, destinationUri: string): Promise<void>;
}
export interface BundledAssetPort {
  /** Resolve a specifically registered APK file. null means absent, never download. */
  resolve(bundlePath: string): Promise<string | null>;
}
export interface PackDatabase {
  /** Only the fixed read queries in pack-loader.ts are allowed. */
  all(sql: string): Promise<unknown[]>;
  close(): Promise<void>;
}
export interface PackSqlitePort {
  /** Do not create a missing DB or share this connection with writable user SQLite. */
  openReadOnly(uri: string): Promise<PackDatabase>;
}
export interface AssetPorts {
  files: LocalFilePort; bundle: BundledAssetPort; sqlite: PackSqlitePort;
}
