export const validators = {
  salary: (v: number) => {
    if (v < 0) return 'Salary cannot be negative';
    if (v > 10000000) return 'Please enter a realistic salary';
    return null;
  },
  percentage: (v: number, min = 0, max = 100) => {
    if (v < min) return `Minimum is ${min}%`;
    if (v > max) return `Maximum is ${max}%`;
    return null;
  },
  k401: (v: number, salary: number) => {
    if (v < 0) return 'Cannot be negative';
    if (v > 100) return 'Cannot exceed 100%';
    const annualContrib = (salary * v) / 100;
    if (annualContrib > 23500) {
      return `At your salary, max is ${((23500 / Math.max(1, salary)) * 100).toFixed(1)}% ($23,500 IRS limit)`;
    }
    return null;
  },
  hsa: (v: number, isFamilyPlan: boolean) => {
    const limit = isFamilyPlan ? 8550 : 4300;
    if (v > limit) return `HSA limit is $${limit.toLocaleString()} for ${isFamilyPlan ? 'family' : 'individual'} plans`;
    return null;
  },
  fsa: (v: number) => {
    if (v > 3300) return 'FSA limit is $3,300 in 2025';
    return null;
  },
  interestRate: (v: number) => {
    if (v < 0) return 'Rate cannot be negative';
    if (v > 50) return 'Please enter a realistic interest rate';
    return null;
  },
  balance: (v: number) => {
    if (v < 0) return 'Balance cannot be negative';
    if (v > 100000000) return 'Please enter a realistic balance';
    return null;
  },
  monthlyAmount: (v: number) => {
    if (v < 0) return 'Amount cannot be negative';
    if (v > 1000000) return 'Please enter a realistic amount';
    return null;
  },
};

