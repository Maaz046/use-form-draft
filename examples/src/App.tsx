import { useState } from 'react';
import { VanillaExample } from './examples/VanillaExample';
import { RHFExample } from './examples/RHFExample';
import { FormikExample } from './examples/FormikExample';

type Tab = 'vanilla' | 'rhf' | 'formik';

export function App() {
  const [tab, setTab] = useState<Tab>('vanilla');

  return (
    <div className="app">
      <header>
        <h1>use-form-draft — live demo</h1>
        <p>
          Auto-save form drafts to localStorage with a recovery banner. Type into any form below,
          close the tab, and reopen — your draft is restored.{' '}
          <a href="https://github.com/Maaz046/use-form-draft" target="_blank" rel="noreferrer">
            Source on GitHub
          </a>
        </p>
      </header>

      <div className="tabs">
        <button
          className={`tab ${tab === 'vanilla' ? 'active' : ''}`}
          onClick={() => setTab('vanilla')}
        >
          Vanilla useState
        </button>
        <button
          className={`tab ${tab === 'rhf' ? 'active' : ''}`}
          onClick={() => setTab('rhf')}
        >
          React Hook Form
        </button>
        <button
          className={`tab ${tab === 'formik' ? 'active' : ''}`}
          onClick={() => setTab('formik')}
        >
          Formik
        </button>
      </div>

      {tab === 'vanilla' && <VanillaExample />}
      {tab === 'rhf' && <RHFExample />}
      {tab === 'formik' && <FormikExample />}

      <footer>
        Drafts are stored under the keys <code>draft:vanilla</code>, <code>draft:rhf</code>,{' '}
        <code>draft:formik</code>. Clear them in DevTools → Application → Local Storage.
      </footer>
    </div>
  );
}
