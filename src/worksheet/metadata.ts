/** Worksheet Metadata; an empty string means the field is not set. */
export type WorksheetMetadata = {
  title: string;
  gradeLevel: string;
  subject: string;
  topic: string;
};

export const emptyMetadata: WorksheetMetadata = {
  title: '',
  gradeLevel: '',
  subject: '',
  topic: '',
};
