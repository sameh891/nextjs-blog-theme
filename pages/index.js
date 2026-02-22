import Image from 'next/image';
import { useMemo, useState } from 'react';

import Footer from '../components/Footer';
import Header from '../components/Header';
import Layout, { GradientBackground } from '../components/Layout';
import { getGlobalData } from '../utils/global-data';
import SEO from '../components/SEO';

const findingsDictionary = {
  underexposed: {
    label: 'الصورة داكنة جدًا',
    details: 'هذا قد يعني أن جودة الأشعة منخفضة أو أن الإضاءة أثناء التصوير غير كافية.',
    severity: 'low'
  },
  overexposed: {
    label: 'الصورة ساطعة جدًا',
    details: 'هذا قد يخفي تفاصيل مهمة ويؤثر على قراءة الأشعة بدقة.',
    severity: 'low'
  },
  moderateContrast: {
    label: 'تباين متوسط',
    details: 'التباين مناسب مبدئيًا لعرض التفاصيل الأساسية.',
    severity: 'low'
  },
  lowDetails: {
    label: 'حدة منخفضة للتفاصيل',
    details: 'قد تكون الصورة غير واضحة أو تحتاج إعادة تصوير للحصول على تفاصيل أفضل.',
    severity: 'medium'
  },
  goodDetails: {
    label: 'حدة تفاصيل جيدة',
    details: 'الصورة واضحة نسبيًا وتظهر حدودًا داخلية بشكل أفضل.',
    severity: 'low'
  }
};

const suggestionMap = {
  low: [
    'احتفظ بنسخة أصلية من الأشعة وشاركها مع طبيب الأشعة للحصول على تقرير رسمي.',
    'إذا كانت لديك أعراض مستمرة، لا تعتمد على التحليل الآلي فقط وراجع الطبيب.'
  ],
  medium: [
    'أعد التصوير في مركز أشعة مع ضبط الجودة للحصول على صورة أوضح.',
    'اطلب تقريرًا تشخيصيًا مكتوبًا من طبيب أشعة مع مقارنة بالتاريخ المرضي.'
  ]
};

function scoreSeverity(findings) {
  if (findings.some((item) => item.severity === 'medium')) {
    return 'medium';
  }

  return 'low';
}

async function runBasicXrayAnalysis(file) {
  const url = URL.createObjectURL(file);
  const image = new Image();

  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
    image.src = url;
  });

  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;

  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0);

  const { data } = ctx.getImageData(0, 0, image.width, image.height);

  let brightnessTotal = 0;
  let gradientTotal = 0;

  const width = image.width;
  const height = image.height;

  for (let y = 0; y < height - 1; y += 2) {
    for (let x = 0; x < width - 1; x += 2) {
      const index = (y * width + x) * 4;
      const rightIndex = (y * width + (x + 1)) * 4;
      const downIndex = ((y + 1) * width + x) * 4;

      const gray = (data[index] + data[index + 1] + data[index + 2]) / 3;
      const grayRight =
        (data[rightIndex] + data[rightIndex + 1] + data[rightIndex + 2]) / 3;
      const grayDown =
        (data[downIndex] + data[downIndex + 1] + data[downIndex + 2]) / 3;

      brightnessTotal += gray;
      gradientTotal += Math.abs(gray - grayRight) + Math.abs(gray - grayDown);
    }
  }

  const sampledPixels = (width / 2) * (height / 2);
  const averageBrightness = brightnessTotal / sampledPixels;
  const averageGradient = gradientTotal / sampledPixels;

  const findings = [];

  if (averageBrightness < 80) {
    findings.push(findingsDictionary.underexposed);
  } else if (averageBrightness > 185) {
    findings.push(findingsDictionary.overexposed);
  } else {
    findings.push(findingsDictionary.moderateContrast);
  }

  if (averageGradient < 35) {
    findings.push(findingsDictionary.lowDetails);
  } else {
    findings.push(findingsDictionary.goodDetails);
  }

  URL.revokeObjectURL(url);

  return {
    brightness: averageBrightness.toFixed(1),
    gradient: averageGradient.toFixed(1),
    findings,
    severity: scoreSeverity(findings)
  };
}

export default function Index({ globalData }) {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [analysisResult, setAnalysisResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const suggestions = useMemo(() => {
    if (!analysisResult) {
      return [];
    }

    return suggestionMap[analysisResult.severity] || suggestionMap.low;
  }, [analysisResult]);

  async function handleAnalyze() {
    if (!file) {
      setError('من فضلك اختر صورة أشعة أولاً.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await runBasicXrayAnalysis(file);
      setAnalysisResult(result);
    } catch (analysisError) {
      setError('حصل خطأ أثناء تحليل الصورة. جرّب ملفًا مختلفًا.');
    } finally {
      setLoading(false);
    }
  }

  function handleFileChange(event) {
    const selectedFile = event.target.files?.[0];

    if (!selectedFile) {
      return;
    }

    if (!selectedFile.type.startsWith('image/')) {
      setError('الملف غير مدعوم. ارفع صورة بصيغة PNG أو JPG.');
      return;
    }

    const localUrl = URL.createObjectURL(selectedFile);

    setFile(selectedFile);
    setPreviewUrl(localUrl);
    setAnalysisResult(null);
    setError('');
  }

  return (
    <Layout>
      <SEO
        title="محلل الأشعة الذكي"
        description="تطبيق مبدئي لتحليل صور الأشعة وتقديم اقتراحات أولية."
      />
      <Header name={globalData.name} />

      <main className="w-full max-w-4xl mx-auto">
        <section className="p-6 space-y-6 border border-gray-200 rounded-xl dark:border-gray-800 bg-white/70 dark:bg-black/30 backdrop-blur">
          <h1 className="text-3xl font-bold text-center lg:text-5xl">محلل الأشعة الذكي</h1>
          <p className="text-center opacity-80">
            ارفع صورة أشعة، وسيتم عمل تحليل تقني مبدئي للصورة مع اقتراحات عامة.
          </p>
          <p className="p-3 text-sm border rounded-md border-amber-500/40 bg-amber-500/10">
            تنبيه مهم: هذا التطبيق للتوعية فقط، وليس تشخيصًا طبيًا نهائيًا. يرجى مراجعة طبيب متخصص دائمًا.
          </p>

          <div className="space-y-3">
            <label htmlFor="xray-upload" className="block font-semibold">
              اختر صورة الأشعة
            </label>
            <input
              id="xray-upload"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="block w-full text-sm"
            />
          </div>

          {previewUrl && (
            <div className="space-y-2">
              <p className="font-semibold">معاينة الصورة:</p>
              <Image
                src={previewUrl}
                alt="X-ray preview"
                width={1200}
                height={900}
                unoptimized
                className="object-contain w-full max-h-96 rounded-lg border border-gray-300 dark:border-gray-700"
              />
            </div>
          )}

          <button
            type="button"
            onClick={handleAnalyze}
            disabled={loading}
            className="px-5 py-2 font-semibold text-white transition bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? 'جارٍ التحليل...' : 'حلل الأشعة'}
          </button>

          {error && <p className="text-red-500">{error}</p>}

          {analysisResult && (
            <div className="p-4 space-y-4 border border-green-500/40 rounded-lg bg-green-500/10">
              <h2 className="text-2xl font-bold">نتيجة التحليل المبدئي</h2>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <p>متوسط الإضاءة: {analysisResult.brightness}</p>
                <p>مؤشر التفاصيل: {analysisResult.gradient}</p>
              </div>

              <div>
                <p className="mb-2 font-semibold">الملاحظات:</p>
                <ul className="space-y-2 list-disc list-inside">
                  {analysisResult.findings.map((finding) => (
                    <li key={finding.label}>
                      <span className="font-semibold">{finding.label}:</span>{' '}
                      {finding.details}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="mb-2 font-semibold">اقتراحات:</p>
                <ul className="space-y-2 list-disc list-inside">
                  {suggestions.map((suggestion) => (
                    <li key={suggestion}>{suggestion}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </section>
      </main>

      <Footer copyrightText={globalData.footerText} />
      <GradientBackground
        variant="large"
        className="fixed top-20 opacity-40 dark:opacity-60"
      />
      <GradientBackground
        variant="small"
        className="absolute bottom-0 opacity-20 dark:opacity-10"
      />
    </Layout>
  );
}

export function getStaticProps() {
  const globalData = getGlobalData();

  return { props: { globalData } };
}
