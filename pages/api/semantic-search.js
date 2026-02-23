const SEMANTIC_SCHOLAR_BASE_URL = 'https://api.semanticscholar.org/graph/v1';

const SEARCH_FIELDS = [
  'title',
  'abstract',
  'year',
  'publicationDate',
  'citationCount',
  'influentialCitationCount',
  'url',
  'openAccessPdf',
  'publicationTypes',
  'fieldsOfStudy',
  'authors.name',
  'journal',
  'venue',
].join(',');

const WOMENS_HEALTH_TERMS = [
  'women',
  'woman',
  'female',
  'pelvic floor',
  'postpartum',
  'pregnancy',
  'maternal',
  'gynec',
  'menopause',
  'breast cancer',
  'urinary incontinence',
  'women\'s health',
];

function normalizeList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [value];
}

function scorePaperForPriority(paper) {
  const haystack = [
    paper.title,
    paper.abstract,
    ...(paper.fieldsOfStudy || []),
    ...(paper.publicationTypes || []),
    paper.journal?.name,
    paper.venue,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const womenTermHits = WOMENS_HEALTH_TERMS.reduce((acc, term) => {
    return haystack.includes(term) ? acc + 1 : acc;
  }, 0);

  const physicalTherapyHits = ['physical therapy', 'physiotherapy', 'rehabilitation', 'exercise therapy'].reduce((acc, term) => {
    return haystack.includes(term) ? acc + 1 : acc;
  }, 0);

  return womenTermHits * 3 + physicalTherapyHits * 2 + (paper.openAccessPdf?.url ? 1 : 0);
}

function sortPapers(papers, sortBy) {
  const prioritized = [...papers].sort((a, b) => scorePaperForPriority(b) - scorePaperForPriority(a));

  if (sortBy === 'publicationDate') {
    return prioritized.sort((a, b) => {
      const aDate = new Date(a.publicationDate || `${a.year || 0}-01-01`).getTime();
      const bDate = new Date(b.publicationDate || `${b.year || 0}-01-01`).getTime();
      return bDate - aDate || scorePaperForPriority(b) - scorePaperForPriority(a);
    });
  }

  if (sortBy === 'citations') {
    return prioritized.sort((a, b) => {
      return (b.citationCount || 0) - (a.citationCount || 0) || scorePaperForPriority(b) - scorePaperForPriority(a);
    });
  }

  return prioritized;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST requests are allowed.' });
  }

  const apiKey = process.env.SEMANTIC_SCHOLAR_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Missing SEMANTIC_SCHOLAR_API_KEY in environment variables.' });
  }

  const {
    query,
    sortBy = 'relevance',
    publicationTypes,
    yearFrom,
    yearTo,
    openAccessPdf,
    limit = 20,
  } = req.body || {};

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'A valid query is required.' });
  }

  const enrichedQuery = `${query} physical therapy women's health OR female rehabilitation`;

  const searchParams = new URLSearchParams({
    query: enrichedQuery,
    limit: String(Math.min(Math.max(Number(limit) || 20, 1), 100)),
    fields: SEARCH_FIELDS,
  });

  if (sortBy === 'publicationDate') {
    searchParams.set('sort', 'publicationDate:desc');
  } else if (sortBy === 'citations') {
    searchParams.set('sort', 'citationCount:desc');
  }

  if (yearFrom || yearTo) {
    const start = yearFrom || 1900;
    const end = yearTo || new Date().getFullYear();
    searchParams.set('year', `${start}-${end}`);
  }

  normalizeList(publicationTypes).forEach((type) => {
    searchParams.append('publicationTypes', type);
  });

  if (openAccessPdf) {
    searchParams.set('openAccessPdf', 'true');
  }

  try {
    const response = await fetch(`${SEMANTIC_SCHOLAR_BASE_URL}/paper/search?${searchParams.toString()}`, {
      headers: {
        'x-api-key': apiKey,
      },
    });

    if (!response.ok) {
      const errorPayload = await response.text();
      return res.status(response.status).json({ error: errorPayload || 'Failed to fetch from Semantic Scholar.' });
    }

    const payload = await response.json();
    const papers = sortPapers(payload?.data || [], sortBy);

    return res.status(200).json({
      total: payload?.total || papers.length,
      papers: papers.map((paper) => ({
        paperId: paper.paperId,
        title: paper.title,
        abstract: paper.abstract,
        year: paper.year,
        publicationDate: paper.publicationDate,
        citationCount: paper.citationCount,
        influentialCitationCount: paper.influentialCitationCount,
        publicationTypes: paper.publicationTypes || [],
        fieldsOfStudy: paper.fieldsOfStudy || [],
        journal: paper.journal?.name || null,
        venue: paper.venue || null,
        authors: (paper.authors || []).map((author) => author.name),
        url: paper.url,
        pdfUrl: paper.openAccessPdf?.url || null,
        priorityScore: scorePaperForPriority(paper),
      })),
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Unexpected error while searching Semantic Scholar.',
      details: error.message,
    });
  }
}
