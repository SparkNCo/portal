flowchart TD
    A[Client requests /api/linear/issues] --> B[GET handler]
    B --> C[getIssues(projectId)]

    C --> D{Redis cache exists?}

    %% CACHE HIT
    D -->|Yes| E[Return cached issues immediately]
    E --> F[Client renders cached data]

    %% BACKGROUND REFRESH
    E --> G[Trigger background refresh async]
    G --> H[fetchFreshIssues(projectId)]
    H --> I[Fetch issues from Linear API]
    I --> J[Map & normalize issue data]
    J --> K[Zod validation]
    K -->|Valid| L[Update Redis cache TTL=120s]
    K -->|Invalid| M[Log error, skip cache update]

    %% CACHE MISS
    D -->|No| N[fetchFreshIssues(projectId)]
    N --> I
    J --> K
    K -->|Valid| O[Save to Redis TTL=120s]
    O --> P[Return fresh data]
    P --> F

    %% ERROR HANDLING
    K -->|Throws| Q[API returns 500 error]
