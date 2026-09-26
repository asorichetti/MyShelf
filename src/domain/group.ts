export interface Group {
  id: number;
  name: string;
  colour: string | null;
  icon: string | null;
  createdAt: string;
}

export type NewGroup = Pick<Group, 'name'> & Partial<Pick<Group, 'colour' | 'icon'>>;
