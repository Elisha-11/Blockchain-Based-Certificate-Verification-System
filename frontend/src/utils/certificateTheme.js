import { FileText, GraduationCap, Award } from 'lucide-react';

/**
 * Single source of truth for certificate-type visual identity.
 * Mirrors the colorScheme/template intent already defined server-side in
 * certificateService.getPresentationConfig() (green=grade12, blue=university,
 * orange=technical), so the printed certificate, the admin list, and the
 * issuance form all agree on what each credential type looks like.
 */
export const CERTIFICATE_THEME = {
  examination: {
    label: 'Examination Result',
    icon: FileText,
    // Admin list "Type" pill
    badge: 'bg-green-100 text-green-800 border border-green-200',
    // Issuance form type-selector button (active state)
    selectorActive: 'border-green-600 bg-green-50 text-green-700',
    // Printed certificate theme (see frontend/src/pages/Certificate.jsx)
    outerBorder: 'border-green-800/80',
    innerBorder: 'border-yellow-600/60',
    seal: 'bg-green-800',
    heading: 'text-green-900',
    divider: 'from-transparent via-green-700 to-transparent',
    subtitle: 'National Examinations Council',
    badgeBg: 'bg-green-50 border-green-200',
    badgeText: 'text-green-900',
    tableHeader: 'bg-green-800',
    accentBorder: 'border-green-700',
    signLeftTitle: 'Chief Examiner',
    signLeftOrg: 'ECZ Board',
    signLeftSub: 'Examinations Council',
    signRightTitle: 'Director',
    signRightOrg: 'Assessment Division',
    signRightSub: 'ECZ',
  },
  technical: {
    label: 'Technical Diploma',
    icon: Award,
    badge: 'bg-orange-100 text-orange-800 border border-orange-200',
    selectorActive: 'border-orange-600 bg-orange-50 text-orange-700',
    outerBorder: 'border-orange-800/80',
    innerBorder: 'border-yellow-600/60',
    seal: 'bg-orange-700',
    heading: 'text-orange-900',
    divider: 'from-transparent via-orange-600 to-transparent',
    subtitle: 'Technical & Vocational Education Registry',
    badgeBg: 'bg-orange-50 border-orange-200',
    badgeText: 'text-orange-900',
    tableHeader: 'bg-orange-700',
    accentBorder: 'border-orange-600',
    signLeftTitle: 'Principal',
    signLeftOrg: 'Administration',
    signRightTitle: 'Registrar',
    signRightOrg: 'Academic & Assessment Office',
  },
  university: {
    label: 'University Degree',
    icon: GraduationCap,
    badge: 'bg-blue-100 text-blue-800 border border-blue-200',
    selectorActive: 'border-blue-600 bg-blue-50 text-blue-700',
    outerBorder: 'border-blue-900/80',
    innerBorder: 'border-yellow-600/60',
    seal: 'bg-blue-900',
    heading: 'text-blue-900',
    divider: 'from-transparent via-yellow-600 to-transparent',
    subtitle: 'Academic Credential Registry',
    badgeBg: 'bg-blue-50 border-blue-200',
    badgeText: 'text-blue-900',
    tableHeader: 'bg-blue-900',
    accentBorder: 'border-blue-800',
    signLeftTitle: 'Vice Chancellor',
    signLeftOrg: 'Administration',
    signRightTitle: 'University Registrar',
    signRightOrg: 'Academic Affairs',
  },
};

/**
 * Normalizes any certificate_type value to one of the three known themes,
 * defaulting to 'university' — matching the fallback behaviour of
 * certificateService.getPresentationConfig() on the backend.
 */
export function resolveCertType(certificateType) {
  // 'grade12' is a legacy value from before certificates were generalized
  // into a single 'examination' type (Grade 7/9/12 + GCE).
  if (certificateType === 'grade12') return 'examination';
  if (certificateType === 'examination' || certificateType === 'technical') {
    return certificateType;
  }
  return 'university';
}

export function getCertificateTheme(certificateType) {
  return CERTIFICATE_THEME[resolveCertType(certificateType)];
}
