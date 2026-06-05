export { packageService, PackageServiceError } from './package-service.ts';
export type { ListResult }                    from './package-service.ts';

export { packageInstallerService, InstallError }   from './package-installer-service.ts';
export type { InstallOptions, InstallResult }      from './package-installer-service.ts';

export { packageUninstallerService, UninstallError } from './package-uninstaller-service.ts';
export type { UninstallOptions, UninstallResult }    from './package-uninstaller-service.ts';

export { packageUpdateService, UpdateError }  from './package-update-service.ts';
export type { UpdateOptions, UpdateResult }   from './package-update-service.ts';

export { packageManagerDetector }             from './package-manager-detector.ts';
export type { PackageManager, DetectionResult } from './package-manager-detector.ts';
