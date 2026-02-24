package AssetExtractor;

use strict;
use warnings;
use v5.28;
use Exporter qw(import);

use File::Copy;

my @masterkey = (0x53, 0x2B, 0x46, 0x31, 0xE4, 0xA7, 0xB9, 0x47, 0x3E, 0x7C, 0xFB);

our $db_key = '9C2BAB97BCF8C0C4F1A9EA7881A213F6C9EBF9D8D4C6A8E43CE5A259BDE7E9FD';

our @EXPORT_OK = qw($db_key extract_asset);

sub extract_asset {
	my ($datadir, $hash, $keyint) = @_;

	$hash =~ /^(..)/;
	my $hdir = $1;
	copy("$datadir/$hdir/$hash", "need_unpack/$hash");
	my @bytes = unpack('C*', pack('Q<', $keyint));
	my @key = map { my $m = $_; map { $m ^ $_; } @bytes; } @masterkey;
	my $n = @key;
	open(my $f, '<:raw', "need_unpack/$hash") or die "failed to open need_unpack/$hash: $!";
	my $z = read($f, my $data, -s $f);
	close($f);
	if ($z > 256) {
		my @decrypted = unpack('C*', $data);
		foreach my $i (256 .. $#decrypted) {
			$decrypted[$i] ^= $key[$i % $n];
		}
		open(my $fw, '>:raw', "need_unpack/$hash") or die "failed to open need_unpack/$hash to decrypt: $!";
		print $fw pack('C*', @decrypted);
		close($fw);
	}
}

1;
