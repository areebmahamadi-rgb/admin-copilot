# Asana Data Notes

The asana_search_tasks returns ALL workspace tasks, not just user's.
The asana_get_tasks with assignee=me times out.

Need to use asana_get_me first to get user GID, then filter.
OR: just use the search_tasks result and filter by name patterns.

The current data showing in the app is from search_tasks which returns workspace-wide tasks.
