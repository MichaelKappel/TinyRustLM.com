using System.Runtime.InteropServices;

namespace TinyRustLM;

internal sealed class NativeRuntimeHandle : SafeHandle
{
    internal NativeRuntimeHandle(ulong value)
        : base(IntPtr.Zero, ownsHandle: true)
    {
        if (value == 0)
        {
            throw new TinyRustLmException("invalid_runtime_handle", "Native runtime handle was zero.");
        }
        SetHandle((IntPtr)unchecked((long)value));
    }

    public override bool IsInvalid => handle == IntPtr.Zero;

    internal ulong Value
    {
        get
        {
            ObjectDisposedException.ThrowIf(IsClosed, this);
            return unchecked((ulong)handle.ToInt64());
        }
    }

    protected override bool ReleaseHandle()
    {
        return NativeMethods.tinyrustlm_runtime_destroy(unchecked((ulong)handle.ToInt64())) == 0;
    }
}
