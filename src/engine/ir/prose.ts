export type ProseManuscript = {
  schemaVersion: 1;
  metadata: Metadata;
  body: ProseBlock[];
};

export type Metadata = {
  title: string;
  byline: string;          // credit name; may be a pen name
  legalName: string;       // real name for the contact block
  contact: ContactBlock;
  genre?: string;
  category?: 'short-story' | 'novelette' | 'novella' | 'novel';
  headerKeyword?: string;  // running-header override; auto-extracted if absent
};

export type ContactBlock =
  | {
      mode: 'structured';
      name: string;
      street: string;
      city: string;
      region: string;
      postalCode: string;
      country?: string;
      phone?: string;
      email: string;
      pronouns?: string;
    }
  | { mode: 'freetext'; text: string };

export type ProseBlock =
  | { type: 'chapter'; title?: string; number?: number }
  | { type: 'paragraph'; runs: Run[] }
  | { type: 'sceneBreak' }
  | { type: 'theEnd' };

export type Run =
  | { type: 'text'; text: string }
  | { type: 'emphasis'; text: string };