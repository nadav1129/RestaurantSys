import { PageContainer, PageHeader, SectionCard } from "../../components/ui/layout";
import { PosActionButton, PosActionStrip } from "../../components/ui/pos";
import {
  ListsIcon,
  ManagementIcon,
  QuickOrderIcon,
  ServiceIcon,
} from "../../components/icons";

const quickActions = [
  {
    label: "Quick Order",
    icon: QuickOrderIcon,
  },
  {
    label: "Service Tools",
    icon: ServiceIcon,
  },
  {
    label: "Management",
    icon: ManagementIcon,
  },
  {
    label: "Lists",
    icon: ListsIcon,
  },
];

export default function ActionsPage() {
  return (
    <PageContainer className="space-y-6">
      <PageHeader
        eyebrow="Quick Actions"
        title="Actions"
        description="A visual placeholder page that preserves the route while the shared POS action system is in place."
      />

      <SectionCard
        title="Action Rail"
        description="These actions mirror the new tablet control language without changing any application logic."
      >
        <PosActionStrip>
          {quickActions.map((action) => (
            <PosActionButton
              key={action.label}
              icon={action.icon}
              label={action.label}
            />
          ))}
        </PosActionStrip>
      </SectionCard>
    </PageContainer>
  );
}
