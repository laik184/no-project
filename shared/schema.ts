export type Project = {
  id: string | number;
  name: string;
  framework?: string | null;
  updatedAt?: string | Date | null;
};

export type Folder = {
  id: string | number;
  name: string;
};