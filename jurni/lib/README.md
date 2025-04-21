# Utility Functions

This directory contains utility functions and shared code used throughout the application.

## Files

### supabase.ts

Creates and exports a Supabase client instance.

#### Usage
```typescript
import { createClient } from '@/lib/supabase';

const supabase = createClient();
```

#### Features
- Client initialization
- Environment variable validation
- Error handling

### utils.ts

Contains general utility functions.

#### Functions
- Helper functions for common operations
- Type conversions
- Data formatting

## Dependencies

- `@supabase/supabase-js`
- Environment variables for configuration

## Usage Example

```typescript
import { createClient } from '@/lib/supabase';

// Initialize Supabase client
const supabase = createClient();

// Use in components or API routes
const { data, error } = await supabase
  .from('table')
  .select('*');
``` 