import SupportTicketUI from '@/components/ui/ai-chat/support-ticket-form';

export default async function ClientPage() {
  return (
    <>
      <div className="container grid place-items-center h-screen">
        <SupportTicketUI />
      </div>
    </>
  );
}
