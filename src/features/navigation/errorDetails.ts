import { appBuild, appVersion } from '@/features/settings/appInfo';

/**
 * The text "Copy error details" hands over: what failed, where, and the
 * stacks. It stays on the phone unless the user chooses to send it somewhere;
 * MyShelf has no crash reporting (ADR 0012).
 */
export function errorDetails(error: Error, where: string, componentStack?: string | null, at: Date = new Date()): string {
  return [
    `MyShelf ${appVersion()} (${appBuild()})`,
    `Screen: ${where}`,
    `When: ${at.toISOString()}`,
    `${error.name}: ${error.message}`,
    error.stack ? `\nStack:\n${error.stack}` : '',
    componentStack ? `\nComponents:${componentStack}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}
