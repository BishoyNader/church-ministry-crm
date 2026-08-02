export type LoginFormValues = {
  email: string;
  password: string;
  remember?: boolean;
};

export type SignupFormValues = {
  churchId: string;
  fullNameAr: string;
  fullNameEn?: string;
  email: string;
  phone?: string;
  password: string;
  confirmPassword: string;
};

export type ForgotPasswordFormValues = {
  email: string;
};

export type ResetPasswordFormValues = {
  password: string;
  confirmPassword: string;
};
