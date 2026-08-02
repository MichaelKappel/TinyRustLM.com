#include <stdint.h>
#include <stdio.h>

extern uint32_t minimodel_native_abi_version(void);

int main(void) {
    const uint32_t version = minimodel_native_abi_version();
    if (version != 2U) {
        fprintf(stderr, "unexpected MiniModel native ABI version: %u\n", version);
        return 1;
    }

    printf("minimodel_native_abi_version=%u\n", version);
    return 0;
}
