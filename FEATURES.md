# Recurring Entries & Daily Reminder

## Recurring entries
Create a repeating expense or income:
```
/recur add 1000 rent expense every 1 month
```
List active recurrences:
```
/recur list
```
Delete a recurrence:
```
/recur delete <id>
```

## Daily reminder
Enable a daily prompt:
```
/reminder on 21:00   # 9 PM each day
```
Disable:
```
/reminder off
```
The bot will send a private message at the set time reminding you to log yesterday's expenses.