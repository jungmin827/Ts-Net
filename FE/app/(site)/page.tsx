// 메인 랜딩 — SSG. 섹션 구성은 docs/SPEC.md §1.1 순서를 따른다.
// 각 섹션은 components/sections/ 에 만들어 여기서 조립한다.

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center gap-4 px-4">
      <h1 className="text-3xl font-bold text-brand">TS넷 랜딩 (퍼블리싱 예정)</h1>
      <ol className="list-decimal text-sm text-gray-500">
        <li>Header</li>
        <li>Hero</li>
        <li>LeadForm (인라인 상담폼)</li>
        <li>LiveFeed (실시간 신청현황 — 실데이터 5건 미만 시 미출력)</li>
        <li>Benefits (차별점 4카드)</li>
        <li>Process (가입절차 5스텝)</li>
        <li>Reviews (후기 슬라이더)</li>
        <li>Footer</li>
        <li>QuickForm (플로팅) / MobileBottomBar</li>
      </ol>
    </main>
  );
}
