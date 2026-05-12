# Business Logic — BotArena

## PIX Payment
- PIX key must be validated and formatted on both frontend and backend
- **Message pattern:** Always provide "Copy and Paste" format to facilitate payment by the client

## Business Hours
- The bot must verify if the current time is within configured periods before responding
- Global absence message must be sent outside business hours

## Menu and Catalog
- Items are configured via the admin panel — not hardcoded
- The bot reads active items from the database at runtime

## Prohibited
- Hardcoding business hours in the bot logic
- Hardcoding PIX keys anywhere outside the database
- Processing messages outside configured business hours without sending the absence message