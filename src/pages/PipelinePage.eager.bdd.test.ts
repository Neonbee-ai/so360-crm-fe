import { readFileSync } from 'fs';
import { join } from 'path';

const read = (f: string) => readFileSync(join(__dirname, f), 'utf8');

describe('CRM pipeline first paint', () => {
  describe('Given the route table', () => {
    it('When App is read Then PipelinePage is imported eagerly, not React.lazy', () => {
      const app = read('../App.tsx');
      expect(app).toMatch(/import PipelinePage from '\.\/pages\/PipelinePage'/);
      expect(app).not.toMatch(/PipelinePage = lazy/);
    });
  });
  describe('Given the pipeline page source', () => {
    it('When loading Then the page shell renders (no early return before ListPageTemplate)', () => {
      expect(read('./PipelinePage.tsx')).not.toMatch(/if \(isInitialLoading\) \{\s*return/);
    });
  });
  describe('Given the leads page', () => {
    it('When the first page loads Then the template does not show a page-level busy skeleton', () => {
      expect(read('./LeadsPage.tsx')).toMatch(/loading=\{false\}/);
    });
  });
});
