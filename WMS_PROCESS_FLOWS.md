# WMS Process Flows — Tester Guide

This document describes the end-to-end operational flows of the Warehouse Management System (WMS).
It is written for testers and focuses on **what needs to happen**, not how it is implemented technically.

---

## Table of Contents

1. [User Onboarding](#1-user-onboarding)
2. [Client Onboarding](#2-client-onboarding)
3. [Inbound Operations (ASN)](#3-inbound-operations-asn)
4. [Inventory Operations](#4-inventory-operations)
5. [Outbound Operations](#5-outbound-operations)
6. [Billing & Invoicing](#6-billing--invoicing)

---

## 1. User Onboarding

**Purpose:** Set up a new system user with the right access level.

**Prerequisites:** None — this is the first step in the system.

### Steps

1. **Create a User**
   - Provide name, email, and login credentials.

2. **Create a Role**
   - Define a role with a meaningful name (e.g., Warehouse Operator, Billing Manager).

3. **Assign Permissions to the Role**
   - Select which actions/modules the role can access.

4. **Assign the Role to the User**
   - Link the created role to the user so their access is active.

> **Verify:** The user can log in and only sees/does what their role allows.

---

## 2. Client Onboarding

**Purpose:** Set up a new client in the system so their goods can be received, stored, and shipped.

**Prerequisites:** At least one Warehouse must already exist in the system.

### Steps

1. **Create the Client**
   - Provide client name and contact details.

2. **Create a Supplier (for the Client)**
   - Add the supplier(s) that will send inbound stock on behalf of this client.

3. **Create SKUs for the Client**
   - Add each product/item the client stores in the warehouse.
   - Each SKU must belong to the client.

4. **Create Rate Cards for the Client**
   - Define the billing rates for each chargeable activity. Rate cards must be created for:

   | Activity | Description |
   |---|---|
   | **INBOUND** | Charge for receiving goods |
   | **PUTAWAY** | Charge for putting stock into storage |
   | **PICKING** | Charge for picking items for an order |
   | **PACKING** | Charge for packing items |
   | **SHIPPING** | Charge for dispatching the order |

> **Verify:** The client exists with at least one SKU and a rate card for each activity.

---

## 3. Inbound Operations (ASN)

**Purpose:** Receive stock into the warehouse from a supplier and put it away into storage.

**Prerequisites:** Client, Supplier, SKUs, and a Warehouse must all exist.

### Status Flow

```
Draft → Confirmed → Receiving → GRN Posted → Closed
```

### Steps

#### 3.1 — Create the ASN
1. Create a new ASN (Advance Shipment Notice).
2. Select the **Warehouse**, **Client**, and **Supplier**.
3. Add **ASN Lines** — one line per SKU being received, with expected quantity.

> Status: **Draft**

---

#### 3.2 — Confirm the ASN
4. Confirm the ASN to signal it is ready to be received.

> Status: **Confirmed**

---

#### 3.3 — Receive the ASN
5. Begin the receiving process for the ASN.
6. Receive each **ASN Line** individually:
   - Record the actual quantity received.
   - A pallet is created for each line received.

> Status: **Receiving**

---

#### 3.4 — Post the GRN (Goods Receipt Note)
7. Once all lines are received, post the GRN.
   - This formally records the stock as arrived in the warehouse.
   - Inventory is updated at this point.

> Status: **GRN Posted**

---

#### 3.5 — Putaway
8. After the GRN is posted, **Putaway Tasks are automatically created** — one task per received pallet/line.
9. Assign each putaway task to a warehouse operator.
10. Operator completes the task by placing the pallet in the designated storage location.

---

#### 3.6 — ASN Closure
11. Once all putaway tasks are completed, the ASN is automatically **Closed**.

> Status: **Closed**

> **Verify:** Inventory reflects the received quantities. All putaway tasks are completed. ASN status is Closed.

---

## 4. Inventory Operations

**Purpose:** Manage and adjust stock already in the warehouse.

**Prerequisites:** Stock must exist in the warehouse (i.e., at least one GRN has been posted).

### Operations

#### 4.1 — Move Stock
- Transfer stock from one storage location to another within the warehouse.
- No quantity changes, only location changes.

#### 4.2 — Adjust Stock
- Manually increase or decrease the quantity of a SKU at a location.
- Used to correct discrepancies found during counts or audits.

#### 4.3 — Place a Hold
- Block a specific quantity of stock from being picked or shipped.
- Useful for damaged goods, quality holds, or disputes.
- A hold can be released when the issue is resolved.

#### 4.4 — View Transactions
- View a log of all inventory movements for auditing purposes.
- Includes receives, putaways, picks, adjustments, and moves.

> **Verify:** After each operation, inventory levels and locations reflect the change correctly.

---

## 5. Outbound Operations

**Purpose:** Fulfill customer orders by picking, packing, and shipping stock.

**Prerequisites:** Client, SKUs, and available inventory must exist.

### Status Flow

```
Sales Order: Draft → Confirmed → Pick Wave Created → Picking → Packing → Shipped
```

### Steps

#### 5.1 — Create a Sales Order
1. Create a new Sales Order for the client.
2. Add order lines — one per SKU with the required quantity.

> Status: **Draft**

---

#### 5.2 — Confirm the Order
3. Confirm the Sales Order to release it for fulfillment.

> Status: **Confirmed**

---

#### 5.3 — Create a Pick Wave
4. Group one or more confirmed Sales Orders into a **Pick Wave**.
   - This batches orders for efficient picking.

> Status: **Pick Wave Created**

---

#### 5.4 — Create Picking Tasks
5. Generate **Picking Tasks** from the Pick Wave.
   - Each task directs an operator to a location to pick a specific item and quantity.
6. Assign picking tasks to warehouse operators.
7. Operators complete the picking tasks.

> Status: **Picking**

---

#### 5.5 — Create Packing Tasks
8. Once picking is complete, **Packing Tasks** are created.
9. Assign packing tasks to warehouse operators.
10. Operators pack the picked items and prepare them for dispatch.

> Status: **Packing**

---

#### 5.6 — Ship the Order
11. Record the shipment — carrier, tracking details, and dispatch confirmation.
12. The Sales Order is marked as **Shipped**.

> Status: **Shipped**

> **Verify:** Inventory is reduced for all shipped quantities. Order status is Shipped.

---

## 6. Billing & Invoicing

**Purpose:** Calculate what the client owes, generate an invoice, and record payment.

**Prerequisites:** Client must exist with active Rate Cards. Warehouse operations (inbound/outbound) must have been completed to generate billing events.

### Status Flow

```
Billing Events → Reviewed/Adjusted → Invoice Generated → Invoice Sent → Payment Recorded
```

### Steps

#### 6.1 — Review Billing Events
1. Billing events are automatically created as warehouse activities occur (inbound, putaway, pick, pack, ship).
2. Review each billing event to check the amounts.
3. If an amount is incorrect, **update the billing event** with the correct value before invoicing.

---

#### 6.2 — Preview & Run Billing
4. Run a **billing preview** to see the calculated charges before committing.
   - This includes **storage costs**, calculated per day for inventory held in the warehouse.
5. Once satisfied, **run the billing** to finalise all charges for the billing period.

---

#### 6.3 — Mark as Ready to Invoice
6. Mark the billing run as **Ready to Invoice**.
   - This signals that all charges have been reviewed and are approved for invoicing.

---

#### 6.4 — Generate & Send the Invoice
7. **Generate the Invoice** from the approved billing events.
8. **Send the Invoice** to the client.

---

#### 6.5 — Record Payment
9. Once the client pays, **record the payment** against the invoice.
   - Include amount, date, and payment reference.

---

#### 6.6 — Client Ledger
10. Open the **Client Ledger** to view a complete payment history for the client.
    - Shows all recorded payments made by the client.
    - Provides visibility into outstanding balances and financial standing.

> **Verify:** Invoice reflects all expected charges. Payment is recorded and ledger is updated.

---

*Document version: 1.0 — For internal QA use.*
