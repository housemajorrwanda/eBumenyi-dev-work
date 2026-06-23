export interface ILoginFormData {
  email: string;
  password: string;
}

export interface IStudentLoginFormData {
  nid: string;
  phoneNumber: string;
}

export interface IUpdateRestPasswordFormData {
  otp: string;
  newPassword: string;
  email: string;
}
export interface IUpdatePasswordFormData {
  currentPassword: string;
  newPassword: string;
  // confirmPassword: string;
}

export interface IResetPasswordRequest {
  email: string;
}

export interface IResetPassword {
  otp: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ISignUp {
  email: string;
  fullNames: string;
  phoneNumber: string;
  district?: string;
  sector?: string;
  cell?: string;
  village?: string;
  NID?: string;
  birthdate?: string;
  gender?: string;
  hospitalId?: string;
}
