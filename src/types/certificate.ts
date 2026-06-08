import type { AccidentInfo, LiabilityResult } from './accident';

export interface ElectronicCertificate {
  id: string;
  certificateNo: string;
  accidentId: string;
  accidentInfo: Pick<AccidentInfo, 'reportNo' | 'occurTime' | 'location' | 'accidentType' | 'vehicles'>;
  liabilityResult: LiabilityResult;
  parties: CertificateParty[];
  certificateContent: string;
  status: CertificateStatus;
  issuedAt: string;
  issuedBy: string;
  validUntil: string;
  verifyCode: string;
  pdfUrl?: string;
}

export interface CertificateParty {
  id: string;
  name: string;
  idCardNo: string;
  phone: string;
  plateNo: string;
  insuranceCompany: string;
  liability: 'full' | 'primary' | 'secondary' | 'none';
  signature?: string;
}

export type CertificateStatus = 'draft' | 'issued' | 'verified' | 'revoked';

export interface CertificateTemplate {
  id: string;
  name: string;
  type: string;
  content: string;
  version: string;
}
