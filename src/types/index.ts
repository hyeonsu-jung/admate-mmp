export type MmpName = 'AppsFlyer' | 'Airbridge' | 'Adjust';

export interface MmpDocument {
  title: string;
  content: string;
  url: string;
  mmp_name: MmpName;
  section_id?: number;
  updated_at?: string;
  crawled_at: string;
}

export interface RawArticle {
  title: string;
  body: string;
  url: string;
  mmp_name: MmpName;
  section_id?: number;
  updated_at?: string;
}
