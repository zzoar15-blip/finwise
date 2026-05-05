import { TransactionList } from '@/components/transactions/TransactionList';

export default function TransactionsPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[24px] font-bold text-[#0f172a]">Transactions</h1>
          <p className="text-[14px] text-[#64748b]">Track and manage your income and expense entries.</p>
        </div>
      </div>
      <TransactionList />
    </div>
  );
}
