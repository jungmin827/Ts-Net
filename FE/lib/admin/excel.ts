import ExcelJS from "exceljs";
import { carrierLabel, giftLabel, statusLabel } from "./labels";
import { toExcelKstDate } from "@/lib/kst";
import { CARRIERS } from "@/lib/validation";

// 상담사 배분용 엑셀. 통신사별로 시트를 분리한다 (배분이 통신사 단위로 이뤄짐 — SPEC §3.4).
// 전화번호는 이 단계에서만 평문으로 다뤄지며, 호출부가 access_logs EXPORT 를 먼저 남긴다.

/** 복호화된 평문 번호를 포함한 한 건. 로깅·영속화 대상이 아니다 */
export interface ExportRecord {
  id: number;
  created_at: string;
  name: string;
  /** 복호화된 평문 — 엑셀 셀에만 쓰고 어디에도 기록하지 않는다 */
  phone: string;
  carrier: string | null;
  product: string | null;
  status: string;
  gift_status: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  memo: string | null;
}

const DATE_FMT = "yyyy-mm-dd hh:mm";

const COLUMNS: Array<{ header: string; width: number; numFmt?: string }> = [
  { header: "접수일시(KST)", width: 18, numFmt: DATE_FMT },
  { header: "이름", width: 10 },
  { header: "연락처", width: 15 },
  { header: "통신사", width: 14 },
  { header: "관심상품", width: 16 },
  { header: "상태", width: 10 },
  { header: "사은품상태", width: 11 },
  { header: "유입경로", width: 26 },
  { header: "메모", width: 44 },
];

/** 유입경로 — source / medium / campaign 을 한 칸에 모아 상담사가 바로 읽게 */
function utmText(r: ExportRecord): string {
  const parts = [r.utm_source, r.utm_medium, r.utm_campaign].filter(
    (v): v is string => !!v && v.trim() !== "",
  );
  return parts.length ? parts.join(" / ") : "(직접유입)";
}

function fillSheet(sheet: ExcelJS.Worksheet, records: ExportRecord[]) {
  sheet.columns = COLUMNS.map((c) => ({
    header: c.header,
    width: c.width,
    style: c.numFmt ? { numFmt: c.numFmt } : undefined,
  }));

  // 헤더 고정 — 스크롤해도 컬럼명이 남아 있게
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  const header = sheet.getRow(1);
  header.font = { bold: true };
  header.alignment = { vertical: "middle" };
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE3F5E9" },
  };
  header.height = 22;

  for (const r of records) {
    sheet.addRow([
      toExcelKstDate(r.created_at),
      r.name,
      r.phone,
      carrierLabel(r.carrier),
      r.product ?? "",
      statusLabel(r.status),
      giftLabel(r.gift_status),
      utmText(r),
      r.memo ?? "",
    ]);
  }

  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: COLUMNS.length },
  };

  // 메모는 길어지므로 줄바꿈 허용
  sheet.getColumn(COLUMNS.length).alignment = { wrapText: true, vertical: "top" };
}

export function buildLeadsWorkbook(
  records: ExportRecord[],
  meta: { from: string; to: string; exportedBy: string },
): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = "TS-Net Admin";
  wb.created = new Date();
  // 내보낸 사람·구간을 파일 속성에 남겨 두면 파일만 봐도 출처를 알 수 있다
  wb.description = `상담신청 ${meta.from} ~ ${meta.to} / 내보낸 계정: ${meta.exportedBy}`;

  fillSheet(wb.addWorksheet("전체"), records);

  for (const carrier of CARRIERS) {
    const rows = records.filter((r) => r.carrier === carrier);
    // 건수가 0이어도 시트는 만든다 — 상담사에게 "해당 통신사 없음"이 전달되게
    fillSheet(wb.addWorksheet(carrier), rows);
  }

  const unassigned = records.filter((r) => !r.carrier);
  if (unassigned.length > 0) {
    fillSheet(wb.addWorksheet("통신사미지정"), unassigned);
  }

  return wb;
}
