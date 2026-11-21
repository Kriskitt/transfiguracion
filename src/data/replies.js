import { archiveEntries } from './archive.js';

export class ReplyRepository {
  constructor() {
    this.entries = archiveEntries.map((entry, index) => ({ id: `example-${index}`, text: entry.text }));
    this.submitted = new Set();
  }

  add(text, submissionId) {
    const value = String(text).trim();
    if (!value || this.submitted.has(submissionId)) return null;
    const entry = { id: `reply-${submissionId}`, text: value };
    this.entries.unshift(entry);
    this.submitted.add(submissionId);
    return entry;
  }

  getAll() { return this.entries.slice(); }
}
