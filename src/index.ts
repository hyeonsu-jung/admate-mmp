import { crawlAndSaveAppsFlyer } from './crawlers/appsflyer';
import { crawlAndSaveAirbridge } from './crawlers/airbridge';
import { crawlAndSaveAdjust } from './crawlers/adjust';

type CrawlerTarget = 'appsflyer' | 'airbridge' | 'adjust' | 'all';

async function main(): Promise<void> {
  const target = (process.env.CRAWL_TARGET ?? 'all') as CrawlerTarget;

  console.log(`=== MMP RAG 크롤러 시작 (target: ${target}) ===`);
  const startTime = Date.now();

  const runners: Record<Exclude<CrawlerTarget, 'all'>, () => Promise<void>> = {
    appsflyer: crawlAndSaveAppsFlyer,
    airbridge: crawlAndSaveAirbridge,
    adjust: crawlAndSaveAdjust,
  };

  if (target === 'all') {
    for (const [name, run] of Object.entries(runners)) {
      console.log(`\n--- ${name} 시작 ---`);
      await run();
    }
  } else if (runners[target]) {
    await runners[target]();
  } else {
    console.error(`알 수 없는 target: ${target}. 유효 값: appsflyer | airbridge | adjust | all`);
    process.exit(1);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n=== 완료 (${elapsed}초) ===`);
}

main().catch(err => {
  console.error('크롤러 오류:', err);
  process.exit(1);
});
