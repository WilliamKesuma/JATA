export type TailorResult = {
  summary: string;
  selectedBulletIds: string[];
  coverEmail: string;
};

export type ActiveTab = "summary" | "email" | "bullets";
