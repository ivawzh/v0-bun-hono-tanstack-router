# RPC Design

## Overview

We use oRPC for all internal HTTP communications via `/rpc` endpoints.
These endpoints are mainly used for web app that will be bundle deployed with server app. So breaking changes are allowed.

## TanStack Query cache

When possible, maintain mapping between oRPC routes and TanStack Query cache keys. This is to help client side cache invalidation.
