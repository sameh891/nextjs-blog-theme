import Link from 'next/link';
import { useState } from 'react';
import Layout, { GradientBackground } from '../components/Layout';
import Header from '../components/Header';
import Footer from '../components/Footer';
import SEO from '../components/SEO';
import { getGlobalData } from '../utils/global-data';

const PUBLICATION_TYPES = [
  'Review',
  'ClinicalTrial',
  'MetaAnalysis',
  'CaseReport',
  'RandomizedControlledTrial',
];

export default function ScholarPage({ globalData }) {
  const [query, setQuery] = useState('pelvic floor physical therapy postpartum');
  const [sortBy, setSortBy] = useState('relevance');
  const [yearFrom, setYearFrom] = useState('');
  const [yearTo, setYearTo] = useState('');
  const [openAccessOnly, setOpenAccessOnly] = useState(true);
  const [publicationTypes, setPublicationTypes] = useState([]);
  const [papers, setPapers] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');

  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);

  const togglePublicationType = (type) => {
    setPublicationTypes((current) => {
      if (current.includes(type)) {
        return current.filter((item) => item !== type);
      }
      return [...current, type];
    });
  };

  const handleSearch = async (event) => {
    event.preventDefault();
    setSearchLoading(true);
    setSearchError('');

    try {
      const response = await fetch('/api/semantic-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          sortBy,
          yearFrom: yearFrom ? Number(yearFrom) : undefined,
          yearTo: yearTo ? Number(yearTo) : undefined,
          publicationTypes,
          openAccessPdf: openAccessOnly,
          limit: 30,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Search failed.');
      }

      setPapers(payload.papers || []);
    } catch (error) {
      setSearchError(error.message);
      setPapers([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleChat = async (event) => {
    event.preventDefault();
    if (!chatInput.trim()) return;

    const updatedMessages = [...chatMessages, { role: 'user', content: chatInput.trim() }];
    setChatMessages(updatedMessages);
    setChatInput('');
    setChatLoading(true);

    try {
      const response = await fetch('/api/groq-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updatedMessages }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Chat failed.');
      }

      setChatMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: `${payload.content}\n\n(model: ${payload.model}${payload.fallbackUsed ? ' - fallback' : ''})`,
        },
      ]);
    } catch (error) {
      setChatMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: `Error: ${error.message}`,
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <Layout>
      <SEO
        title="Women's Health Physical Therapy Scholar"
        description="Semantic Scholar research explorer with Groq AI assistant"
      />
      <Header name={`${globalData.name} | Scholar`} />
      <main className="w-full px-4 pb-16 space-y-8">
        <div className="p-5 bg-white border border-gray-200 rounded-xl dark:bg-black/30 dark:border-white/20">
          <h1 className="text-3xl font-semibold dark:text-white">Women&apos;s Health Physical Therapy Scholar</h1>
          <p className="mt-2 text-sm opacity-80 dark:text-white">
            ابحثي عن أبحاث العلاج الطبيعي لصحة المرأة مع ترتيب ذكي + شات متخصص.{' '}
            <Link href="/" className="underline">
              الرجوع للمدونة
            </Link>
          </p>
        </div>

        <section className="p-5 space-y-4 bg-white border border-gray-200 rounded-xl dark:bg-black/30 dark:border-white/20">
          <h2 className="text-xl font-medium dark:text-white">Research Search (Semantic Scholar)</h2>
          <form onSubmit={handleSearch} className="space-y-4">
            <input
              className="w-full px-3 py-2 bg-transparent border rounded-md dark:text-white"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search query"
            />

            <div className="grid gap-3 md:grid-cols-3">
              <label className="flex flex-col gap-1 text-sm dark:text-white">
                Sort by
                <select
                  className="px-3 py-2 bg-transparent border rounded-md"
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value)}
                >
                  <option value="relevance">Relevance + Women&apos;s Health Priority</option>
                  <option value="publicationDate">Newest First</option>
                  <option value="citations">Most Cited</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm dark:text-white">
                From year
                <input
                  className="px-3 py-2 bg-transparent border rounded-md"
                  type="number"
                  value={yearFrom}
                  onChange={(event) => setYearFrom(event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm dark:text-white">
                To year
                <input
                  className="px-3 py-2 bg-transparent border rounded-md"
                  type="number"
                  value={yearTo}
                  onChange={(event) => setYearTo(event.target.value)}
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-3">
              {PUBLICATION_TYPES.map((type) => (
                <label key={type} className="inline-flex items-center gap-2 text-sm dark:text-white">
                  <input
                    type="checkbox"
                    checked={publicationTypes.includes(type)}
                    onChange={() => togglePublicationType(type)}
                  />
                  {type}
                </label>
              ))}
            </div>

            <label className="inline-flex items-center gap-2 text-sm dark:text-white">
              <input
                type="checkbox"
                checked={openAccessOnly}
                onChange={(event) => setOpenAccessOnly(event.target.checked)}
              />
              Open Access PDF only
            </label>

            <button
              type="submit"
              className="px-4 py-2 text-white transition rounded-md bg-gradient-3 hover:opacity-90"
              disabled={searchLoading}
            >
              {searchLoading ? 'Searching...' : 'Search papers'}
            </button>
          </form>

          {searchError && <p className="text-red-600">{searchError}</p>}

          <div className="space-y-3">
            {papers.map((paper) => (
              <article key={paper.paperId || paper.url} className="p-4 border rounded-lg dark:border-white/20">
                <h3 className="text-lg font-semibold dark:text-white">{paper.title}</h3>
                <p className="mt-1 text-xs opacity-80 dark:text-white">
                  {paper.year || 'N/A'} • Citations: {paper.citationCount || 0} • Priority Score: {paper.priorityScore}
                </p>
                <p className="mt-2 text-sm dark:text-white">{paper.abstract || 'No abstract available.'}</p>
                <div className="flex flex-wrap gap-4 mt-3 text-sm">
                  {paper.url && (
                    <a href={paper.url} target="_blank" rel="noreferrer" className="underline">
                      Semantic Scholar
                    </a>
                  )}
                  {paper.pdfUrl && (
                    <a href={paper.pdfUrl} target="_blank" rel="noreferrer" className="underline">
                      Download PDF
                    </a>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="p-5 space-y-4 bg-white border border-gray-200 rounded-xl dark:bg-black/30 dark:border-white/20">
          <h2 className="text-xl font-medium dark:text-white">Smart Chat (Groq)</h2>
          <form onSubmit={handleChat} className="flex gap-2">
            <input
              className="flex-1 px-3 py-2 bg-transparent border rounded-md dark:text-white"
              value={chatInput}
              onChange={(event) => setChatInput(event.target.value)}
              placeholder="Ask about women's health physical therapy..."
            />
            <button
              type="submit"
              className="px-4 py-2 text-white transition rounded-md bg-gradient-4 hover:opacity-90"
              disabled={chatLoading}
            >
              {chatLoading ? 'Sending...' : 'Send'}
            </button>
          </form>

          <div className="space-y-2">
            {chatMessages.map((message, index) => (
              <div key={`${message.role}-${index}`} className="p-3 border rounded-md dark:border-white/20">
                <p className="text-xs uppercase opacity-70 dark:text-white">{message.role}</p>
                <p className="text-sm whitespace-pre-wrap dark:text-white">{message.content}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
      <Footer copyrightText={globalData.footerText} />
      <GradientBackground variant="large" className="fixed top-20 opacity-30 dark:opacity-40" />
      <GradientBackground variant="small" className="absolute bottom-0 opacity-10 dark:opacity-10" />
    </Layout>
  );
}

export function getStaticProps() {
  const globalData = getGlobalData();
  return { props: { globalData } };
}
