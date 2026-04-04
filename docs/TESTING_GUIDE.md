# Discover Page Optimization Testing Guide

## Quick Verification Checklist

### 1. Functional Testing
- [ ] Page loads without errors
- [ ] Hero carousel displays 5 episodes
- [ ] Brand shelf shows top 15 podcasts
- [ ] Curiosity feed loads episodes
- [ ] Infinite scroll works (load more button)
- [ ] Country switching updates content
- [ ] Subscription buttons work
- [ ] Search bar functions correctly

### 2. Performance Testing
- [ ] Initial page load < 3 seconds (normal network)
- [ ] Cached loads < 1 second
- [ ] No "Feed too large" errors on popular podcasts
- [ ] Multiple batch requests execute in parallel
- [ ] Slow feeds timeout after 5 seconds

### 3. Error Handling
- [ ] Failed podcast fetches don't block page
- [ ] Partial results display correctly
- [ ] Timeout errors handled gracefully
- [ ] Network errors show appropriate feedback

## Detailed Testing Scenarios

### Scenario 1: Fresh Page Load

**Steps:**
1. Clear browser cache (hard refresh: Ctrl+Shift+R)
2. Navigate to `/discover`
3. Open Network tab in DevTools

**Expected Results:**
```
Timeline:
[0s] Page renders with skeleton
[0-2s] /api/apple/top completes
[2-4s] Two /api/batch-episodes requests (parallel)
[3-5s] Content fully loaded

Network Tab:
- /api/apple/top: ~2.6s (first load)
- /api/batch-episodes (hero): 3-4s
- /api/batch-episodes (feed): 3-4s
- Parallel execution visible (requests overlap)
```

**Pass Criteria:**
- Total load time < 5 seconds
- Both batch-episodes requests start at same time (±100ms)
- Page shows skeleton immediately
- No JavaScript errors in console

### Scenario 2: Cached Load

**Steps:**
1. Load page (fresh as in Scenario 1)
2. Wait 5 seconds for complete load
3. Refresh page (F5)
4. Observe Network tab

**Expected Results:**
```
Timeline:
[0s] Page renders
[0-1s] /api/apple/top completes (cached)
[1-2s] Content fully loaded

Network Tab:
- /api/apple/top: <100ms (cached)
- /api/batch-episodes: Still needs to fetch
- Much faster overall
```

**Pass Criteria:**
- /api/apple/top responds in <100ms
- Total load time < 2 seconds
- Cache headers visible in response

### Scenario 3: Country Switching

**Steps:**
1. Load page with default country (US)
2. Wait for full load
3. Switch country via settings/selector
4. Observe network activity

**Expected Results:**
```
- Content clears
- Skeleton reappears
- New /api/apple/top request (different country)
- New batch-episodes requests
- Content repopulates with new country's podcasts
```

**Pass Criteria:**
- Switching is immediate (no page reload)
- Loading states appear
- New content matches selected country
- Cache works per-country (switching back is fast)

### Scenario 4: Large Podcast Feeds

**Steps:**
1. Note current top podcasts
2. Look for podcasts with 500+ episodes (e.g., Joe Rogan, The Daily)
3. Verify they load without "Feed too large" error

**Expected Results:**
```
- All podcasts load successfully
- No "Feed too large to process" errors
- Large feeds (15-40MB) process correctly
```

**Pass Criteria:**
- No feed size errors in console
- All popular podcasts display
- Episode data loads correctly

### Scenario 5: Timeout Handling

**Steps:**
1. Throttle network to Slow 3G (Chrome DevTools)
2. Load discover page
3. Observe behavior after 5 seconds

**Expected Results:**
```
- Page doesn't hang indefinitely
- After 5 seconds, timeouts trigger
- Partial results display
- Some podcasts show "Failed to load" gracefully
- Page remains interactive
```

**Pass Criteria:**
- Maximum wait per batch: 5 seconds
- Page doesn't freeze
- Partial content displays
- Error handling is graceful

### Scenario 6: Parallel Execution

**Steps:**
1. Open Chrome DevTools → Network tab
2. Load discover page
3. Look for overlapping requests

**Expected Results:**
```
Network Timeline View:
Time →  0s         1s         2s         3s         4s
        |----------|----------|----------|----------|
Top     |==|
        |  |
Hero       |====================|
           |                    |
Feed       |====================|
```

**Pass Criteria:**
- Hero and Feed requests start simultaneously (±100ms)
- Both requests process in parallel
- End time is max(hero, feed), not hero + feed

### Scenario 7: Error Recovery

**Steps:**
1. Open DevTools → Network
2. Block specific podcast API calls (or simulate 500 errors)
3. Load discover page

**Expected Results:**
```
- Failed podcasts show error in console
- Other podcasts still load successfully
- Page displays partial data
- No complete page failure
- User can still interact with available content
```

**Pass Criteria:**
- Failures are isolated
- Console shows specific error per failed podcast
- Page remains functional
- No unhandled promise rejections

### Scenario 8: Infinite Scroll

**Steps:**
1. Load discover page
2. Scroll to bottom of feed
3. Click "Load More" (or trigger auto-load)
4. Observe new content loading

**Expected Results:**
```
- Load More button triggers new batch-episodes request
- Skeleton appears for new items
- New episodes append to feed
- No duplicate episodes
- Subscription status correct on new items
```

**Pass Criteria:**
- New content loads successfully
- No duplicates (check podcastId-episodeId pairs)
- Performance consistent with initial load
- Can repeat multiple times

### Scenario 9: Subscription Integration

**Steps:**
1. Load discover page
2. Note a podcast in feed
3. Subscribe to that podcast
4. Verify subscription state updates

**Expected Results:**
```
- Subscribe button changes state immediately
- isSubscribed flag updates
- Subscription persists on refresh
- Feed items reflect subscription status
```

**Pass Criteria:**
- Optimistic UI update (instant)
- Server sync completes
- State consistent across components
- No subscription bugs introduced

### Scenario 10: Mobile Performance

**Steps:**
1. Open Chrome DevTools
2. Switch to mobile device emulation (iPhone 12, Pixel 5)
3. Throttle to 4G
4. Load discover page

**Expected Results:**
```
- Mobile layout displays correctly
- Load time < 5 seconds on 4G
- Touch interactions work
- Infinite scroll functions
- Swipe gestures in carousel work
```

**Pass Criteria:**
- Responsive design intact
- Performance acceptable on mobile networks
- No layout shifts during load
- Touch interactions smooth

## Performance Benchmarks

### Target Metrics (Desktop, Cable)
```
First Contentful Paint (FCP):  < 1s
Largest Contentful Paint (LCP): < 2.5s
Time to Interactive (TTI):      < 3s
Total Load Time:                < 5s
```

### Target Metrics (Mobile, 4G)
```
First Contentful Paint (FCP):  < 2s
Largest Contentful Paint (LCP): < 4s
Time to Interactive (TTI):      < 5s
Total Load Time:                < 7s
```

### API Response Times
```
/api/apple/top (cached):     < 100ms
/api/apple/top (uncached):   < 3s
/api/batch-episodes:         < 5s
Individual podcast timeout:   5s (enforced)
```

## Testing Tools

### Chrome DevTools
```bash
# Network Tab
- View request timing
- Check parallel execution
- Monitor cache hits
- Throttle network speed

# Performance Tab
- Record page load
- Analyze timeline
- Check for bottlenecks
- Measure Web Vitals

# Console
- Monitor errors
- Check timing logs
- Verify data flow
```

### Lighthouse
```bash
# Run Lighthouse audit
1. Open Chrome DevTools
2. Navigate to Lighthouse tab
3. Select "Performance" + "Best Practices"
4. Click "Analyze page load"

Target Scores:
- Performance:    > 85
- Best Practices: > 90
```

### Network Throttling Profiles
```
Fast 3G:
- Download: 1.6 Mbps
- Upload: 750 Kbps
- Latency: 562.5ms

Slow 3G:
- Download: 400 Kbps
- Upload: 400 Kbps
- Latency: 2000ms

Offline:
- Test offline behavior
```

## Automated Testing Script

```javascript
// Console script for quick performance check
async function testDiscoverPage() {
  console.time('Total Load Time');

  // Measure individual API calls
  const start = performance.now();

  const topStart = performance.now();
  const topRes = await fetch('/api/apple/top?country=us&limit=30');
  const topEnd = performance.now();
  console.log(`Top Podcasts: ${topEnd - topStart}ms`);

  const topData = await topRes.json();
  const podcasts = topData.podcasts.slice(0, 5);

  const batchStart = performance.now();
  const batchRes = await fetch('/api/apple/podcasts/batch-episodes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      podcasts: podcasts.map(p => ({ podcastId: p.id, limit: 3 })),
      country: 'us'
    })
  });
  const batchEnd = performance.now();
  console.log(`Batch Episodes: ${batchEnd - batchStart}ms`);

  const batchData = await batchRes.json();
  console.log(`Success Rate: ${batchData.results.filter(r => r.success).length}/${batchData.results.length}`);

  console.timeEnd('Total Load Time');
}

// Run test
testDiscoverPage();
```

## Common Issues & Solutions

### Issue 1: Slow Initial Load
**Symptom**: First load still takes 10+ seconds
**Check**:
- Verify cache is working (`cachedTopPodcasts` should populate)
- Check if batch-episodes are running in parallel
- Look for network tab to confirm parallel requests
**Solution**: Ensure Promise.allSettled is used, not Promise.all

### Issue 2: Cache Not Working
**Symptom**: Every load takes 2.6+ seconds
**Check**:
- Verify module-level variable exists
- Check cache TTL hasn't expired
- Confirm cache key matches
**Solution**: Restart server to reset cache, verify cache logic

### Issue 3: Timeout Not Triggering
**Symptom**: Page hangs on slow feeds
**Check**:
- Verify Promise.race implementation
- Check timeout value (should be 5000ms)
- Confirm timeout promise rejects
**Solution**: Review batch-episodes route timeout logic

### Issue 4: Feed Size Errors
**Symptom**: Still seeing "Feed too large" errors
**Check**:
- Verify MAX_FEED_SIZE is 50MB (52428800 bytes)
- Check if feeds are genuinely >50MB
**Solution**: Confirm change in apple-podcasts.ts line 23

### Issue 5: Partial Results Not Displaying
**Symptom**: One failure blocks all results
**Check**:
- Verify Promise.allSettled is used
- Check error handling in map function
- Confirm results processing handles rejections
**Solution**: Ensure settledResults.map checks result.status

## Rollback Procedure

If optimizations cause issues:

```bash
# Restore original discover page
cd C:\Users\liad\Desktop\PodCatch
mv src/app/discover/page.backup.tsx src/app/discover/page.tsx

# Restart development server
npm run dev
```

## Success Criteria Summary

The optimization is successful if:

✅ Initial page load < 5 seconds (Desktop/Cable)
✅ Cached loads < 2 seconds
✅ No "Feed too large" errors on popular podcasts
✅ Parallel execution visible in Network tab
✅ Failures are isolated (no complete page failure)
✅ Country switching works correctly
✅ Subscriptions function properly
✅ Infinite scroll operates smoothly
✅ All existing features preserved

## Reporting Issues

If you find issues during testing:

1. **Capture Evidence**
   - Screenshot of error
   - Network tab waterfall
   - Console error messages
   - Performance timeline

2. **Document Steps**
   - Exact steps to reproduce
   - Environment details (browser, network)
   - Expected vs actual behavior

3. **Check Known Issues**
   - Review OPTIMIZATION_COMPARISON.md
   - Check console for specific errors
   - Verify it's not a cache issue

4. **Test Rollback**
   - Use backup file to confirm it's from optimization
   - If rollback fixes it, optimization needs adjustment
