import React from 'react';

// [TECHNICAL DEBT] Break-Glass protocol is temporarily DISABLED for development testing.
// To re-enable: restore the full implementation from the implementation_plan.md.
// The production version must:
//   1. Decode the JWT on the frontend and check break_glass_active === true.
//   2. Show the BreakGlassModal if the flag is absent.
//   3. Hit POST /api/auth/break-glass to obtain an elevated token.
//   4. Backend enforceBreakGlassForSysAdmin middleware must be re-applied on
//      caregiverRoutes.js and assignmentRoutes.js.

interface BreakGlassWrapperProps {
  children: React.ReactNode;
  targetHub: string;
}

// [TECHNICAL DEBT] Passthrough wrapper — renders children unconditionally.
// Re-implement full enforcement before production deployment.
export const BreakGlassWrapper: React.FC<BreakGlassWrapperProps> = ({ children }) => {
  return <>{children}</>;
};
