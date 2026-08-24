using Microsoft.Win32.SafeHandles;

namespace TinyRustLM;

internal sealed class NativeRuntimeHandle : SafeHandleZeroOrMinusOneIsInvalid
{
    internal NativeRuntimeHandle(ulong value)
        : base(ownsHandle: true)
    {
        if (value == 0 || value > long.MaxValue || !Environment.Is64BitProcess)
        {
            throw new TinyRustLmException("native-runtime-handle");
        }

        SetHandle(new IntPtr((long)value));
    }

    internal ulong Value
    {
        get
        {
            if (IsClosed || IsInvalid)
            {
                throw new ObjectDisposedException(nameof(NativeRuntimeHandle));
            }

            return checked((ulong)handle.ToInt64());
        }
    }

    internal void DestroyChecked()
    {
        if (IsClosed || IsInvalid)
        {
            return;
        }

        var value = Value;
        var report = NativeJson.Call<NativeRuntimeDestroyReport>(() =>
            NativeMethods.tinyrustlm_runtime_destroy_json(value));
        NativeReportValidation.RequireSchema(report.Schema, "tinyrustlm.native.runtime_destroy/1");
        if (!report.Destroyed || report.Handle != value)
        {
            throw new TinyRustLmException("native-runtime-destroy-report");
        }

        SetHandleAsInvalid();
    }

    protected override bool ReleaseHandle()
    {
        var pointer = NativeMethods.tinyrustlm_runtime_destroy_json(unchecked((ulong)handle.ToInt64()));
        if (pointer == IntPtr.Zero)
        {
            return false;
        }

        NativeMethods.tinyrustlm_string_free(pointer);
        return true;
    }
}

internal sealed record NativeRuntimeDestroyReport(string Schema, ulong Handle, bool Destroyed);
