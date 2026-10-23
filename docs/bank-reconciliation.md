# Reviewed bank reconciliation

Open Trust accounts, then Review bank statements and reconciliation. Import one
completed USD bank statement for a designated account. Review the account,
dates, opening and closing balances and every line before confirming. Originals
stay private in the installation and its backup; downloading records an audit
entry. No bank connection, extraction service or money movement is performed.

CSV uses `id,date,amount,description` and optional `checkNumber,traceNumber`
columns. Dates are ISO dates. Amounts are signed decimal dollars with at most two
decimal places. Positive amounts are bank credits, negative amounts bank debits.
Quoted fields support commas, quotes and newlines. A stable bank transaction id
is required, and reuse across statements is refused. OFX and QFX import one USD
STMTRS section with FITID, DTPOSTED, TRNAMT, optional CHECKNUM and REFNUM, and
LEDGERBAL. The reviewed closing amount must equal LEDGERBAL. For PDF, attach the
original and enter reviewed extracted CSV lines; Terrace does not perform OCR.
The static PDF screen rejects known active content and is not a malware verdict.
Files are at most 5 MB, with at most 2,000 lines. Duplicate imports return the
original statement when every reviewed term agrees; changed terms and overlapping
periods are refused. Original imports are immutable.

Match a bank line to one or more exact book source keys. Amounts must sum exactly.
A check requires its bank number and amount and that number in the book source
reference. An ACH trace requires the same trace in the bank and book references.
Settlement and ACH batch matches use the exact sum of reviewed source amounts.
Each book source and bank id can be matched only once per account. The present
sources are journal entries and recorded custody transfers. ACCT-017 and ACCT-018
inherit these matching rules when their check register and transmitted file
records ship; reconciliation itself creates no payment or settlement instruction.

Record outstanding checks and deposits with a source and follow-up reference.
Outstanding net is deposits minus outstanding payments. Adjusted bank cash is the
statement closing balance plus outstanding net; it must equal book cash and the
beneficiary balances. Equivalently, bank closing equals book cash minus outstanding
net. Unmatched bank lines, unexplained book sources, unassigned historical cash,
a statement arithmetic difference or any three-way difference refuse sign-off.
Resolve a missing posting through its normal ledger door, then match it. A zero
numeric difference alone is insufficient. Prior bank matches carry forward;
outstanding sources need explicit review in each subsequent statement.

A sign-off retains the exact sources, figures, actor and time. Changed book sources
invalidate it. Month close requires a current signed statement covering the full
month for every mapped bank account. Reopen a closed month before revising its
reconciliation. Scoped staff can open an account only when their existing report
capability and portfolio assignments cover every property mapped to it. Existing
journal preparation roles prepare imports and matches; existing period sign-off
roles sign. Portal identities and API credentials cannot use the bank doors.

Staff allocation-statement downloads also contain a cash draft derived from
actual dated beneficiary postings: opening cash, inflows, outflows, closing cash,
liabilities, reserve requirements, separate deposit funds and bank-review status.
Source ids and original references remain visible. Reserve requirements are not
expenses. This draft is not published or delivered, grants no distribution
authority and supplies no owner-portal invoice bundle. ACCT-012 remains partial
until corrected publication, scheduled delivery, complete payment sources and
receipt attachments are implemented and proved.
