import type { Metadata } from "next";
import { GuideLayout } from "../components/GuideLayout";

export const metadata: Metadata = {
  title: "개인정보 처리방침 | BREATHLINE CO₂ 테이블",
  description: "BREATHLINE CO₂ 테이블의 개인정보 및 기기 내 훈련 기록 처리 방침입니다.",
  alternates: { canonical: "/privacy" },
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <GuideLayout
      eyebrow="PRIVACY"
      title="개인정보 처리방침"
      description="BREATHLINE CO₂ 테이블은 사용자가 훈련을 이어갈 수 있도록 필요한 최소한의 기기 내 정보를 사용합니다."
      canonicalPath="/privacy"
      sections={[
        {
          title: "수집하는 정보",
          paragraphs: [
            "현재 BREATHLINE CO₂ 테이블은 회원 가입이나 서버 계정을 요구하지 않습니다. 훈련 완료·중단 기록과 소리 설정은 사용자의 브라우저 기기 내 저장소에만 보관될 수 있습니다.",
            "이 정보는 같은 기기에서 최근 훈련 기록과 설정을 보여 주기 위한 용도이며, BREATHLINE이 별도의 서버로 전송하거나 판매하지 않습니다.",
          ],
        },
        {
          title: "기기 내 기록의 삭제",
          paragraphs: [
            "최근 훈련 영역의 ‘기록 지우기’를 선택하면 브라우저에 저장된 훈련 기록을 삭제할 수 있습니다. 브라우저의 사이트 데이터 삭제 기능을 사용해도 저장된 설정과 기록을 제거할 수 있습니다.",
          ],
        },
        {
          title: "외부 서비스와 향후 변경",
          paragraphs: [
            "현재 이 사이트는 광고를 표시하지 않습니다. 향후 분석 도구, 광고 또는 외부 서비스를 도입해 개인정보 처리 방식이 바뀌는 경우, 이 페이지를 업데이트하고 필요한 고지와 동의 절차를 제공합니다.",
            "이 방침은 서비스 운영 방식의 변경에 따라 수정될 수 있습니다. 중요한 변경이 있으면 이 페이지의 업데이트 날짜를 함께 갱신합니다.",
          ],
        },
      ]}
    />
  );
}
