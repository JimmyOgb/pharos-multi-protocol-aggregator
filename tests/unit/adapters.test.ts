import test from 'node:test';
import assert from 'node:assert/strict';
import { PharosRpcClient, padAddress, padUint256, formatEther, parseEther } from '../../src/core/rpc-client.ts';
import { WPROSAdapter, WPROS_CONTRACT_ADDRESS } from '../../src/adapters/wpros-adapter.ts';
import { FarooStPROSAdapter, FAROO_STPROS_PROXY_ADDRESS } from '../../src/adapters/faroo-stpros-adapter.ts';

test('RPC Client Helpers: padAddress & padUint256', () => {
  const addr = '0x52c48d4213107b20bc583832b0d951fb9ca8f0b0';
  const padded = padAddress(addr);
  assert.equal(padded.length, 64);
  assert.equal(padded, '00000000000000000000000052c48d4213107b20bc583832b0d951fb9ca8f0b0');

  const paddedNum = padUint256(1000000000000000000n);
  assert.equal(paddedNum.length, 64);
  assert.equal(paddedNum, '0000000000000000000000000000000000000000000000000de0b6b3a7640000');
});

test('RPC Client Helpers: formatEther & parseEther', () => {
  const oneEtherWei = 1000000000000000000n;
  const formatted = formatEther(oneEtherWei);
  assert.equal(formatted, '1.0000');

  const parsed = parseEther('1.5');
  assert.equal(parsed, 1500000000000000000n);
});

test('WPROS Adapter: Transaction Preparation', async () => {
  const dummyRpc = new PharosRpcClient('http://127.0.0.1:8545');
  const adapter = new WPROSAdapter(dummyRpc);
  const user = '0x13b0D85CcB8bf860b6b79AF3029fCA081AE9beF2';

  // Test deposit
  const depositTx = await adapter.prepareDeposit(user, '5.0');
  assert.equal(depositTx.to, WPROS_CONTRACT_ADDRESS);
  assert.equal(depositTx.from, user);
  assert.equal(depositTx.operation, 'DEPOSIT');
  assert.equal(depositTx.data, '0xd0e30db0');
  assert.equal(depositTx.value, '0x4563918244f40000'); // 5 ETH/PROS in hex
  assert.equal(depositTx.signed, false);

  // Test withdraw
  const withdrawTx = await adapter.prepareWithdraw(user, '2.5');
  assert.equal(withdrawTx.to, WPROS_CONTRACT_ADDRESS);
  assert.equal(withdrawTx.operation, 'WITHDRAW');
  assert.ok(withdrawTx.data.startsWith('0x2e1a7d4d'));
  assert.equal(withdrawTx.value, '0x0');
});

test('Faroo stPROS Adapter: Transaction Preparation & Approval', async () => {
  const dummyRpc = new PharosRpcClient('http://127.0.0.1:8545');
  const adapter = new FarooStPROSAdapter(dummyRpc);
  const user = '0x13b0D85CcB8bf860b6b79AF3029fCA081AE9beF2';

  // Test deposit
  const depositTx = await adapter.prepareDeposit(user, '10.0');
  assert.equal(depositTx.to, FAROO_STPROS_PROXY_ADDRESS);
  assert.equal(depositTx.operation, 'DEPOSIT');
  assert.ok(depositTx.data.startsWith('0x6e553f65')); // deposit(uint256,address)
  assert.equal(depositTx.requiresPriorApproval, true);
  assert.ok(depositTx.approvalTransaction);
  assert.equal(depositTx.approvalTransaction.operation, 'APPROVE');
  assert.ok(depositTx.approvalTransaction.data.startsWith('0x095ea7b3'));

  // Test redeem/withdraw
  const redeemTx = await adapter.prepareWithdraw(user, '8.0');
  assert.equal(redeemTx.to, FAROO_STPROS_PROXY_ADDRESS);
  assert.equal(redeemTx.operation, 'REDEEM');
  assert.ok(redeemTx.data.startsWith('0xba087652'));
});
