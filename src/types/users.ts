export interface User {
  name: string;
  email: string;
  role: "CONFIRMATOR" | "ADMIN";
  password: string;
  confirmPassword?: User["password"];
}
