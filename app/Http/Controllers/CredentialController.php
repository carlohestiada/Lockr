<?php

namespace App\Http\Controllers;

use App\Models\Credential;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class CredentialController extends Controller
{
    public function index(Request $request)
    {
        Gate::authorize('viewAny', Credential::class);

        $validated = $request->validate([
            'search' => ['sometimes', 'string', 'max:255'],
            'favorite' => ['sometimes', 'boolean'],
            'folder_id' => [
                'sometimes',
                'integer',
                Rule::exists('folders', 'id')
                    ->where('user_id', $request->user()->id),
            ],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ]);

        $query = $request->user()->credentials()
            ->with('folder:id,name')
            ->latest();

        if (isset($validated['search']) && $validated['search'] !== '') {
            $search = $validated['search'];
            $query->where(function ($query) use ($search) {
                $pattern = "%{$search}%";
                $query->whereRaw('LOWER(title) LIKE LOWER(?)', [$pattern])
                    ->orWhereRaw('LOWER(username) LIKE LOWER(?)', [$pattern])
                    ->orWhereRaw('LOWER(website_url) LIKE LOWER(?)', [$pattern]);
            });
        }

        if (isset($validated['favorite'])) {
            $query->where('is_favorite', $validated['favorite']);
        }

        if (isset($validated['folder_id'])) {
            $query->where('folder_id', $validated['folder_id']);
        }

        return response()->json($query->paginate($validated['per_page'] ?? 20));
    }

    public function show(Request $request, Credential $credential)
    {
        Gate::authorize('view', $credential);

        $validated = $request->validate([
            'field' => ['sometimes', Rule::in(['password'])],
        ]);

        if (($validated['field'] ?? null) === 'password') {
            return response()->json([
                'data' => [
                    'password' => $credential->password,
                ],
            ]);
        }

        return response()->json([
            'data' => [
                'id' => $credential->id,
                'title' => $credential->title,
                'username' => $credential->username,
                'password' => $credential->password,
                'website_url' => $credential->website_url,
                'notes' => $credential->notes,
                'folder_id' => $credential->folder_id,
                'is_favorite' => $credential->is_favorite,
                'created_at' => $credential->created_at,
                'updated_at' => $credential->updated_at,
            ],
        ]);
    }

    public function store(Request $request)
    {
        Gate::authorize('create', Credential::class);

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:150'],
            'username' => ['nullable', 'string', 'max:255'],
            'password' => ['required', 'string', 'max:10000'],
            'website_url' => ['nullable', 'url', 'max:2048'],
            'notes' => ['nullable', 'string', 'max:10000'],
            'folder_id' => [
                'nullable',
                Rule::exists('folders', 'id')
                    ->where('user_id', $request->user()->id),
            ],
            'is_favorite' => ['sometimes', 'boolean'],
        ]);

        $credential = $request->user()
            ->credentials()
            ->create($validated);

        return response()->json($credential, 201);
    }

    public function update(Request $request, Credential $credential)
    {
        Gate::authorize('update', $credential);

        $validated = $request->validate([
            'title' => ['sometimes', 'required', 'string', 'max:150'],
            'username' => ['sometimes', 'nullable', 'string', 'max:255'],
            'password' => ['sometimes', 'required', 'string', 'max:10000'],
            'website_url' => ['sometimes', 'nullable', 'url', 'max:2048'],
            'notes' => ['sometimes', 'nullable', 'string', 'max:10000'],
            'folder_id' => [
                'sometimes',
                'nullable',
                Rule::exists('folders', 'id')
                    ->where('user_id', $request->user()->id),
            ],
            'is_favorite' => ['sometimes', 'boolean'],
        ]);

        $credential->update($validated);

        return response()->json(['message' => 'Credential updated.']);
    }

    public function destroy(Credential $credential)
    {
        Gate::authorize('delete', $credential);

        $credential->delete();

        return response()->json(['message' => 'Credential deleted.']);
    }
}
