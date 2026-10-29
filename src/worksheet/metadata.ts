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

/** Each Metadata field with its label in the Properties Panel and its element in Worksheet Files. */
export const metadataFields: {
  field: keyof WorksheetMetadata;
  label: string;
  element: string;
}[] = [
  { field: 'title', label: 'Title', element: 'title' },
  { field: 'gradeLevel', label: 'Grade Level', element: 'grade' },
  { field: 'subject', label: 'Subject', element: 'subject' },
  { field: 'topic', label: 'Topic', element: 'topic' },
];
