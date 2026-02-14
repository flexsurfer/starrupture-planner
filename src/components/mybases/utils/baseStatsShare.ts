import type { Base, Corporation, Item } from '../../../state/db';
import type { MyBasesStats, TopProducedItem } from '../types';

const CARD_WIDTH = 1200;
const CARD_HEIGHT = 630;
const SHARE_FILE_NAME = 'starrupture-bases-stats.png';
const DEFAULT_PLANNER_URL = 'https://www.starrupture-planner.com/mybases';

export type BasesStatsShareResult = 'shared' | 'copied' | 'downloaded' | 'cancelled';

export type { TopProducedItem };

const numberFormatter = new Intl.NumberFormat();
const TOP_STATS_X = 64;
const TOP_STATS_TOTAL_WIDTH = 538;
const TOP_STATS_GAP = 18;

const clampPercentage = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
};

const formatPercent = (value: number): string => `${clampPercentage(value).toFixed(1)}%`;

const drawRoundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fillStyle: string,
): void => {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fillStyle = fillStyle;
  ctx.fill();
};

const truncateText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string => {
  if (ctx.measureText(text).width <= maxWidth) return text;

  let trimmed = text;
  while (trimmed.length > 0) {
    const candidate = `${trimmed}...`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      return candidate;
    }
    trimmed = trimmed.slice(0, -1);
  }

  return '...';
};

const getTopBasesByBuildings = (bases: Base[], maxCount = 4): Base[] => {
  return [...bases]
    .sort((a, b) => {
      const byBuildings = b.buildings.length - a.buildings.length;
      if (byBuildings !== 0) return byBuildings;
      return a.name.localeCompare(b.name);
    })
    .slice(0, maxCount);
};

const getTotalPlans = (bases: Base[]): number =>
  bases.reduce((sum, base) => sum + (base.productions?.length ?? 0), 0);

export const calculateTopProducedItems = (
  bases: Base[],
  itemsById: Record<string, Item>,
  corporations: Corporation[],
  maxCount = 4,
): TopProducedItem[] => {
  const corporationsById = new Map<string, Corporation>();
  const fallbackXpByItemId = new Map<string, number>();
  for (const corporation of corporations) {
    corporationsById.set(corporation.id, corporation);
    for (const level of corporation.levels) {
      const levelXp = level.xp ?? 0;
      for (const component of level.components) {
        fallbackXpByItemId.set(
          component.id,
          Math.max(fallbackXpByItemId.get(component.id) ?? 0, levelXp),
        );
      }
    }
  }

  const totalRateByItemId = new Map<string, number>();
  const costByItemId = new Map<string, number>();

  for (const base of bases) {
    for (const plan of base.productions || []) {
      if (!plan.selectedItemId) continue;

      const planRate = plan.targetAmount ?? 0;
      if (planRate > 0) {
        totalRateByItemId.set(
          plan.selectedItemId,
          (totalRateByItemId.get(plan.selectedItemId) ?? 0) + planRate,
        );
      }

      let planLevelXp = 0;
      if (plan.corporationLevel) {
        const corporation = corporationsById.get(plan.corporationLevel.corporationId);
        const corpLevel = corporation?.levels.find((lvl) => lvl.level === plan.corporationLevel?.level);
        const component = corpLevel?.components.find((c) => c.id === plan.selectedItemId);
        if (component) {
          planLevelXp = corpLevel?.xp ?? 0;
        }
      }
      if (planLevelXp === 0) {
        planLevelXp = fallbackXpByItemId.get(plan.selectedItemId) ?? 0;
      }

      costByItemId.set(
        plan.selectedItemId,
        Math.max(costByItemId.get(plan.selectedItemId) ?? 0, planLevelXp),
      );
    }
  }

  return Array.from(costByItemId.entries())
    .map(([itemId, levelXpCost]) => ({
      itemId,
      itemName: itemsById[itemId]?.name ?? itemId,
      totalRatePerMinute: totalRateByItemId.get(itemId) ?? 0,
      levelXpCost,
    }))
    .sort((a, b) => {
      const byCost = b.levelXpCost - a.levelXpCost;
      if (byCost !== 0) return byCost;
      return a.itemName.localeCompare(b.itemName);
    })
    .slice(0, maxCount);
};

const getPlannerUrl = (): string => {
  return DEFAULT_PLANNER_URL;
};

const isMobileUserAgent = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const mobilePattern = /Android|iPhone|iPad|iPod|Mobile/i;
  const ua = navigator.userAgent || '';
  if (mobilePattern.test(ua)) return true;

  // userAgentData is not in lib.dom typings everywhere yet.
  const uaData = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData;
  return uaData?.mobile === true;
};

export const createBasesStatsShareText = (
  stats: MyBasesStats,
  bases: Base[],
  topProducedItems: TopProducedItem[],
): string => {
  const totalPlans = getTotalPlans(bases);
  const topBases = getTopBasesByBuildings(bases, 3);
  const topBasesLine = topBases.length > 0
    ? topBases.map((base) => `${base.name} (${base.buildings.length})`).join(', ')
    : 'No bases yet';
  const topItemsLine = topProducedItems.length > 0
    ? topProducedItems.map((item) => `${item.itemName} (${numberFormatter.format(item.totalRatePerMinute)}/min)`).join(', ')
    : 'No output items configured';

  return [
    'My StarRupture base stats',
    `Bases: ${numberFormatter.format(stats.totalBases)}`,
    `Buildings: ${numberFormatter.format(stats.totalBuildings)}`,
    `Plans: ${numberFormatter.format(totalPlans)}`,
    `Heat: ${numberFormatter.format(stats.totalHeat)} / ${numberFormatter.format(stats.totalHeatCapacity)} (${formatPercent(stats.heatPercentage)})`,
    `Energy: ${numberFormatter.format(stats.totalEnergyUsed)} / ${numberFormatter.format(stats.totalEnergyProduced)} MW (${formatPercent(stats.energyPercentage)})`,
    `Top bases: ${topBasesLine}`,
    `Top items produced: ${topItemsLine}`,
    `Made with StarRupture Planner: ${getPlannerUrl()}`,
  ].join('\n');
};

const drawBackground = (ctx: CanvasRenderingContext2D): void => {
  const gradient = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
  gradient.addColorStop(0, '#0a1028');
  gradient.addColorStop(0.45, '#112a4b');
  gradient.addColorStop(1, '#172554');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  ctx.globalAlpha = 0.24;
  ctx.fillStyle = '#60a5fa';
  ctx.beginPath();
  ctx.arc(1020, 120, 200, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#22d3ee';
  ctx.beginPath();
  ctx.arc(180, 560, 170, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.globalAlpha = 0.08;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  for (let x = 0; x <= CARD_WIDTH; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, CARD_HEIGHT);
    ctx.stroke();
  }
  for (let y = 0; y <= CARD_HEIGHT; y += 48) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(CARD_WIDTH, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
};

interface MetricCardConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  value: string;
  hint?: string;
  accentColor: string;
}

const drawMetricCard = (ctx: CanvasRenderingContext2D, config: MetricCardConfig): void => {
  drawRoundedRect(ctx, config.x, config.y, config.width, config.height, 20, 'rgba(10, 18, 38, 0.65)');
  drawRoundedRect(ctx, config.x, config.y, config.width, 6, 4, config.accentColor);

  ctx.fillStyle = 'rgba(226, 232, 240, 0.82)';
  ctx.font = '500 24px "Trebuchet MS", "Segoe UI", sans-serif';
  ctx.fillText(config.label, config.x + 20, config.y + 42);

  ctx.fillStyle = '#f8fafc';
  ctx.font = '700 44px "Trebuchet MS", "Segoe UI", sans-serif';
  ctx.fillText(config.value, config.x + 20, config.y + 92);

  if (config.hint) {
    ctx.fillStyle = 'rgba(226, 232, 240, 0.8)';
    ctx.font = '500 20px "Trebuchet MS", "Segoe UI", sans-serif';
    ctx.fillText(config.hint, config.x + 20, config.y + config.height - 18);
  }
};

export const renderBasesStatsCard = async (
  stats: MyBasesStats,
  bases: Base[],
  topProducedItems: TopProducedItem[],
): Promise<Blob> => {
  const totalPlans = getTotalPlans(bases);
  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not create 2D canvas context.');
  }

  drawBackground(ctx);

  ctx.fillStyle = '#f8fafc';
  ctx.font = '700 52px "Trebuchet MS", "Segoe UI", sans-serif';
  ctx.fillText('My Bases Overview', 64, 88);

  ctx.fillStyle = 'rgba(226, 232, 240, 0.88)';
  ctx.font = '500 22px "Trebuchet MS", "Segoe UI", sans-serif';
  ctx.fillText('StarRupture Planner', 66, 122);

  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(226, 232, 240, 0.82)';
  ctx.font = '500 20px "Trebuchet MS", "Segoe UI", sans-serif';
  ctx.fillText(new Date().toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }), CARD_WIDTH - 64, 88);
  ctx.textAlign = 'left';

  const topStatsCardWidth = (TOP_STATS_TOTAL_WIDTH - (TOP_STATS_GAP * 2)) / 3;

  drawMetricCard(ctx, {
    x: TOP_STATS_X,
    y: 154,
    width: topStatsCardWidth,
    height: 130,
    label: 'Bases',
    value: numberFormatter.format(stats.totalBases),
    accentColor: '#60a5fa',
  });
  drawMetricCard(ctx, {
    x: TOP_STATS_X + topStatsCardWidth + TOP_STATS_GAP,
    y: 154,
    width: topStatsCardWidth,
    height: 130,
    label: 'Buildings',
    value: numberFormatter.format(stats.totalBuildings),
    accentColor: '#22d3ee',
  });
  drawMetricCard(ctx, {
    x: TOP_STATS_X + (topStatsCardWidth + TOP_STATS_GAP) * 2,
    y: 154,
    width: topStatsCardWidth,
    height: 130,
    label: 'Plans',
    value: numberFormatter.format(totalPlans),
    accentColor: '#a3e635',
  });
  drawMetricCard(ctx, {
    x: 64,
    y: 300,
    width: 538,
    height: 130,
    label: 'Heat Load',
    value: `${numberFormatter.format(stats.totalHeat)} / ${numberFormatter.format(stats.totalHeatCapacity)}`,
    hint: stats.isHeatOverCapacity ? 'Status: overloaded' : 'Status: stable',
    accentColor: stats.isHeatOverCapacity ? '#ef4444' : '#38bdf8',
  });
  drawMetricCard(ctx, {
    x: 64,
    y: 446,
    width: 538,
    height: 130,
    label: 'Energy Load',
    value: `${numberFormatter.format(stats.totalEnergyUsed)} / ${numberFormatter.format(stats.totalEnergyProduced)} MW`,
    hint: stats.isEnergyInsufficient ? 'Status: shortage' : 'Status: balanced',
    accentColor: stats.isEnergyInsufficient ? '#ef4444' : '#22c55e',
  });

  drawRoundedRect(ctx, 630, 154, 506, 204, 22, 'rgba(10, 18, 38, 0.65)');
  ctx.fillStyle = '#f8fafc';
  ctx.font = '700 28px "Trebuchet MS", "Segoe UI", sans-serif';
  ctx.fillText('Top Bases by Buildings', 658, 198);

  const topBases = getTopBasesByBuildings(bases, 3);
  if (topBases.length === 0) {
    ctx.fillStyle = 'rgba(226, 232, 240, 0.8)';
    ctx.font = '500 24px "Trebuchet MS", "Segoe UI", sans-serif';
    ctx.fillText('Create your first base to start sharing stats.', 658, 250);
  } else {
    topBases.forEach((base, index) => {
      const rowY = 238 + index * 50;
      drawRoundedRect(ctx, 656, rowY - 22, 454, 42, 14, 'rgba(30, 41, 59, 0.68)');

      ctx.fillStyle = '#93c5fd';
      ctx.font = '700 22px "Trebuchet MS", "Segoe UI", sans-serif';
      ctx.fillText(`#${index + 1}`, 676, rowY + 5);

      ctx.fillStyle = '#f8fafc';
      ctx.font = '600 20px "Trebuchet MS", "Segoe UI", sans-serif';
      const nameMaxWidth = 300;
      const fittedName = truncateText(ctx, base.name, nameMaxWidth);
      ctx.fillText(fittedName, 736, rowY + 5);

      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(226, 232, 240, 0.82)';
      ctx.font = '500 16px "Trebuchet MS", "Segoe UI", sans-serif';
      ctx.fillText(`${numberFormatter.format(base.buildings.length)} b`, 1088, rowY + 5);
      ctx.textAlign = 'left';
    });
  }

  drawRoundedRect(ctx, 630, 380, 506, 196, 22, 'rgba(10, 18, 38, 0.65)');
  ctx.fillStyle = '#f8fafc';
  ctx.font = '700 28px "Trebuchet MS", "Segoe UI", sans-serif';
  ctx.fillText('Top Items Produced', 658, 424);

  if (topProducedItems.length === 0) {
    ctx.fillStyle = 'rgba(226, 232, 240, 0.8)';
    ctx.font = '500 24px "Trebuchet MS", "Segoe UI", sans-serif';
    ctx.font = '500 24px "Trebuchet MS", "Segoe UI", sans-serif';
    ctx.fillText('No targeted output items.', 658, 476);
  } else {
    topProducedItems.slice(0, 4).forEach((item, index) => {
      const rowY = 462 + index * 30;
      drawRoundedRect(ctx, 656, rowY - 20, 454, 28, 10, 'rgba(30, 41, 59, 0.68)');

      ctx.fillStyle = '#22d3ee';
      ctx.font = '700 18px "Trebuchet MS", "Segoe UI", sans-serif';
      ctx.fillText(`#${index + 1}`, 674, rowY);

      ctx.fillStyle = '#f8fafc';
      ctx.font = '600 18px "Trebuchet MS", "Segoe UI", sans-serif';
      const fittedItemName = truncateText(ctx, item.itemName, 270);
      ctx.fillText(fittedItemName, 726, rowY);

      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(226, 232, 240, 0.82)';
      ctx.font = '500 17px "Trebuchet MS", "Segoe UI", sans-serif';
      ctx.fillText(`${numberFormatter.format(item.totalRatePerMinute)}/m`, 1088, rowY);
      ctx.textAlign = 'left';
    });
  }

  ctx.fillStyle = 'rgba(226, 232, 240, 0.85)';
  ctx.font = '500 20px "Trebuchet MS", "Segoe UI", sans-serif';
  ctx.fillText('', 66, 605);

  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(226, 232, 240, 0.78)';
  ctx.font = '500 18px "Trebuchet MS", "Segoe UI", sans-serif';
  ctx.fillText(getPlannerUrl(), CARD_WIDTH - 64, 605);
  ctx.textAlign = 'left';

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/png');
  });
  if (!blob) {
    throw new Error('Failed to render stats card image.');
  }
  return blob;
};

const tryNativeShare = async (file: File, text: string): Promise<'shared' | 'cancelled' | null> => {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
    return null;
  }
  // On desktop Chrome/macOS, the OS "Copy" action from share sheet can duplicate attachments in Discord.
  // Prefer direct Clipboard API for desktop and keep native share sheet for mobile.
  if (!isMobileUserAgent()) {
    return null;
  }

  const canShareFile = typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
  const shareData: ShareData = canShareFile
    ? {
      title: 'My StarRupture base stats',
      files: [file],
    }
    : {
      title: 'My StarRupture base stats',
      text,
    };

  if (!canShareFile) {
    shareData.text = text;
  }

  try {
    await navigator.share(shareData);
    return 'shared';
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return 'cancelled';
    }
    console.error('Native share failed:', error);
    return null;
  }
};

const tryCopyCardToClipboard = async (imageBlob: Blob): Promise<boolean> => {
  if (typeof navigator === 'undefined') return false;
  if (!navigator.clipboard || typeof navigator.clipboard.write !== 'function') return false;
  if (typeof ClipboardItem === 'undefined') return false;

  try {
    const item = new ClipboardItem({
      'image/png': imageBlob,
    });
    await navigator.clipboard.write([item]);
    return true;
  } catch (error) {
    console.error('Clipboard copy failed:', error);
    return false;
  }
};

const triggerCardDownload = (imageBlob: Blob): void => {
  const objectUrl = URL.createObjectURL(imageBlob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = SHARE_FILE_NAME;
  anchor.style.display = 'none';

  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
};

export const shareBasesStats = async (
  stats: MyBasesStats,
  bases: Base[],
  topProducedItems: TopProducedItem[],
): Promise<BasesStatsShareResult> => {
  const cardBlob = await renderBasesStatsCard(stats, bases, topProducedItems);
  const shareText = createBasesStatsShareText(stats, bases, topProducedItems);
  const shareFile = new File([cardBlob], SHARE_FILE_NAME, { type: 'image/png' });

  const nativeShareResult = await tryNativeShare(shareFile, shareText);
  if (nativeShareResult === 'shared') return 'shared';
  if (nativeShareResult === 'cancelled') return 'cancelled';

  const copied = await tryCopyCardToClipboard(cardBlob);
  if (copied) {
    return 'copied';
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(shareText);
    } catch (error) {
      console.error('Text clipboard fallback failed:', error);
    }
  }

  triggerCardDownload(cardBlob);
  return 'downloaded';
};
