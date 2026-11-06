<?php

namespace App\Http\Controllers;

use App\Models\Folder;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

class FolderController extends Controller
{
    public function index(Request $request)
    {
        Gate::authorize('viewAny', Folder::class);

        return response()->json(
            $request->user()->folders()->withCount('credentials')->orderBy('name')->get()
        );
    }

    public function store(Request $request)
    {
        Gate::authorize('create', Folder::class);

        $name = $this->validatedFolderName($request);

        try {
            $folder = $request->user()->folders()->create(['name' => $name]);
        } catch (QueryException $exception) {
            $this->rethrowUnlessFolderNameConflict($exception);
            throw ValidationException::withMessages([
                'name' => 'You already have a folder with this name.',
            ]);
        }

        return response()->json($folder, 201);
    }

    public function update(Request $request, Folder $folder)
    {
        Gate::authorize('update', $folder);

        $name = $this->validatedFolderName($request, $folder);

        try {
            $folder->update(['name' => $name]);
        } catch (QueryException $exception) {
            $this->rethrowUnlessFolderNameConflict($exception);
            throw ValidationException::withMessages([
                'name' => 'You already have a folder with this name.',
            ]);
        }

        return response()->json(['message' => 'Folder updated.']);
    }

    public function destroy(Folder $folder)
    {
        Gate::authorize('delete', $folder);

        DB::transaction(fn () => $folder->delete());

        return response()->json(['message' => 'Folder deleted.']);
    }

    private function validatedFolderName(Request $request, ?Folder $folder = null): string
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
        ]);

        $duplicate = $request->user()->folders()
            ->whereRaw('LOWER(name) = LOWER(?)', [$validated['name']])
            ->when($folder, fn ($query) => $query->where('id', '<>', $folder->id))
            ->exists();

        if ($duplicate) {
            throw ValidationException::withMessages([
                'name' => 'You already have a folder with this name.',
            ]);
        }

        return $validated['name'];
    }

    private function rethrowUnlessFolderNameConflict(QueryException $exception): void
    {
        $isUniqueViolation = in_array((string) $exception->getCode(), ['23000', '23505'], true);
        $isFolderNameConflict = str_contains($exception->getMessage(), 'folders_user_id_lower_name_unique')
            || str_contains($exception->getMessage(), 'folders_user_id_name_unique');

        if (! $isUniqueViolation || ! $isFolderNameConflict) {
            throw $exception;
        }
    }
}
